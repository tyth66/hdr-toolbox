use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use tracing_subscriber::fmt::MakeWriter;

const DEFAULT_MAX_LOG_FILE_BYTES: u64 = 10 * 1024 * 1024;
const DEFAULT_MAX_LOG_FILES: usize = 3;

#[derive(Clone)]
struct LogSettings {
    directory: PathBuf,
    max_file_bytes: u64,
    max_files: usize,
}

struct LogFileState {
    #[cfg(test)]
    path: PathBuf,
    file: File,
    bytes_written: u64,
}

struct RollingLogFile<T>
where
    T: FnMut() -> String,
{
    settings: LogSettings,
    timestamp_source: T,
    state: LogFileState,
}

impl<T> RollingLogFile<T>
where
    T: FnMut() -> String,
{
    fn new(mut settings: LogSettings, mut timestamp_source: T) -> io::Result<Self> {
        settings.max_files = settings.max_files.max(1);
        let state = open_existing_or_new_log_file(&settings, &mut timestamp_source)?;

        Ok(Self {
            settings,
            timestamp_source,
            state,
        })
    }

    fn rotate(&mut self) -> io::Result<()> {
        self.state.file.flush()?;
        let timestamp = (self.timestamp_source)();
        self.state = open_new_log_file(&self.settings, &timestamp)?;
        Ok(())
    }
}

impl<T> Write for RollingLogFile<T>
where
    T: FnMut() -> String,
{
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        if self.state.bytes_written > 0
            && self.state.bytes_written + buf.len() as u64 > self.settings.max_file_bytes
        {
            self.rotate()?;
        }

        let written = self.state.file.write(buf)?;
        self.state.bytes_written += written as u64;
        Ok(written)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.state.file.flush()
    }
}

struct SharedLogWriter {
    inner: Arc<Mutex<RollingLogFile<Box<dyn FnMut() -> String + Send>>>>,
}

impl SharedLogWriter {
    fn new(settings: LogSettings) -> io::Result<Self> {
        let timestamp_source: Box<dyn FnMut() -> String + Send> = Box::new(current_timestamp);
        let inner = RollingLogFile::new(settings, timestamp_source)?;

        Ok(Self {
            inner: Arc::new(Mutex::new(inner)),
        })
    }
}

struct LogWriteGuard {
    inner: Arc<Mutex<RollingLogFile<Box<dyn FnMut() -> String + Send>>>>,
    stderr: io::Stderr,
}

impl Write for LogWriteGuard {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let file_result = self
            .inner
            .lock()
            .map_err(|_| io::Error::other("log writer mutex poisoned"))
            .and_then(|mut writer| writer.write_all(buf));

        let stderr_result = self.stderr.write_all(buf);

        if let Err(error) = file_result {
            let _ = writeln!(self.stderr, "Failed to write HDR Toolbox log file: {error}");
        }

        stderr_result?;
        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        if let Ok(mut writer) = self.inner.lock() {
            let _ = writer.flush();
        }
        self.stderr.flush()
    }
}

impl<'a> MakeWriter<'a> for SharedLogWriter {
    type Writer = LogWriteGuard;

    fn make_writer(&'a self) -> Self::Writer {
        LogWriteGuard {
            inner: Arc::clone(&self.inner),
            stderr: io::stderr(),
        }
    }
}

pub fn init_logging() {
    let env_filter = tracing_subscriber::EnvFilter::from_default_env()
        .add_directive(tracing::Level::INFO.into());

    match default_log_settings().and_then(SharedLogWriter::new) {
        Ok(writer) => tracing_subscriber::fmt()
            .with_env_filter(env_filter)
            .with_target(false)
            .with_ansi(false)
            .with_writer(writer)
            .init(),
        Err(error) => {
            eprintln!("Failed to initialize HDR Toolbox file logging: {error}");
            tracing_subscriber::fmt()
                .with_env_filter(env_filter)
                .with_target(false)
                .init();
        }
    }
}

fn default_log_settings() -> io::Result<LogSettings> {
    Ok(LogSettings {
        directory: default_log_directory()?,
        max_file_bytes: DEFAULT_MAX_LOG_FILE_BYTES,
        max_files: DEFAULT_MAX_LOG_FILES,
    })
}

fn default_log_directory() -> io::Result<PathBuf> {
    #[cfg(debug_assertions)]
    {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        Ok(manifest_dir
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or(manifest_dir)
            .join("log"))
    }

    #[cfg(not(debug_assertions))]
    {
        let exe_path = std::env::current_exe()?;
        Ok(exe_path
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."))
            .join("log"))
    }
}

fn open_existing_or_new_log_file<T>(
    settings: &LogSettings,
    timestamp_source: &mut T,
) -> io::Result<LogFileState>
where
    T: FnMut() -> String,
{
    fs::create_dir_all(&settings.directory)?;

    if let Some(path) = newest_log_file(&settings.directory)? {
        let bytes_written = fs::metadata(&path)?.len();
        if bytes_written < settings.max_file_bytes {
            let file = OpenOptions::new().create(true).append(true).open(&path)?;
            return Ok(LogFileState {
                #[cfg(test)]
                path,
                file,
                bytes_written,
            });
        }
    }

    let timestamp = timestamp_source();
    open_new_log_file(settings, &timestamp)
}

fn open_new_log_file(settings: &LogSettings, timestamp: &str) -> io::Result<LogFileState> {
    fs::create_dir_all(&settings.directory)?;
    prune_old_logs(&settings.directory, settings.max_files.saturating_sub(1))?;

    let path = unique_timestamped_log_path(&settings.directory, timestamp);
    let file = OpenOptions::new()
        .create_new(true)
        .append(true)
        .open(&path)?;

    Ok(LogFileState {
        #[cfg(test)]
        path,
        file,
        bytes_written: 0,
    })
}

fn timestamped_log_path(directory: &Path, timestamp: &str) -> PathBuf {
    directory.join(format!("{timestamp}.log"))
}

fn unique_timestamped_log_path(directory: &Path, timestamp: &str) -> PathBuf {
    let path = timestamped_log_path(directory, timestamp);
    if !path.exists() {
        return path;
    }

    for suffix in 1.. {
        let candidate = directory.join(format!("{timestamp}-{suffix}.log"));
        if !candidate.exists() {
            return candidate;
        }
    }

    unreachable!("suffix loop always returns a candidate")
}

fn prune_old_logs(directory: &Path, keep_count: usize) -> io::Result<()> {
    let logs = sorted_log_files(directory)?;
    let remove_count = logs.len().saturating_sub(keep_count);

    for path in logs.into_iter().take(remove_count) {
        fs::remove_file(path)?;
    }

    Ok(())
}

fn newest_log_file(directory: &Path) -> io::Result<Option<PathBuf>> {
    Ok(sorted_log_files(directory)?.into_iter().last())
}

fn sorted_log_files(directory: &Path) -> io::Result<Vec<PathBuf>> {
    if !directory.exists() {
        return Ok(Vec::new());
    }

    let mut logs = fs::read_dir(directory)?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|extension| extension == "log"))
        .collect::<Vec<_>>();

    logs.sort_by(|left, right| left.file_name().cmp(&right.file_name()));
    Ok(logs)
}

#[cfg(windows)]
fn current_timestamp() -> String {
    let time = unsafe { windows::Win32::System::SystemInformation::GetLocalTime() };

    format_timestamp_parts(
        time.wYear,
        time.wMonth,
        time.wDay,
        time.wHour,
        time.wMinute,
        time.wSecond,
        time.wMilliseconds,
    )
}

#[cfg(not(windows))]
fn current_timestamp() -> String {
    let duration = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format_timestamp(duration)
}

#[cfg(any(not(windows), test))]
fn format_timestamp(duration: std::time::Duration) -> String {
    let total_seconds = duration.as_secs() as i64;
    let days = total_seconds.div_euclid(86_400);
    let seconds_of_day = total_seconds.rem_euclid(86_400);
    let (year, month, day) = civil_date_from_unix_days(days);
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;

    format_timestamp_parts(
        year as u16,
        month as u16,
        day as u16,
        hour as u16,
        minute as u16,
        second as u16,
        duration.subsec_millis() as u16,
    )
}

fn format_timestamp_parts(
    year: u16,
    month: u16,
    day: u16,
    hour: u16,
    minute: u16,
    second: u16,
    millisecond: u16,
) -> String {
    format!("{year:04}{month:02}{day:02}-{hour:02}{minute:02}{second:02}-{millisecond:03}")
}

#[cfg(any(not(windows), test))]
fn civil_date_from_unix_days(days_since_epoch: i64) -> (i64, i64, i64) {
    let days = days_since_epoch + 719_468;
    let era = if days >= 0 { days } else { days - 146_096 } / 146_097;
    let day_of_era = days - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_phase = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_phase + 2) / 5 + 1;
    let month = month_phase + if month_phase < 10 { 3 } else { -9 };

    if month <= 2 {
        year += 1;
    }

    (year, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use std::sync::{Arc, Mutex};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_dir(name: &str) -> std::path::PathBuf {
        let id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("hdr-toolbox-{name}-{id}"))
    }

    fn write_sized_file(path: &Path, bytes: usize) {
        fs::write(path, vec![b'x'; bytes]).expect("test log file should be writable");
    }

    #[test]
    fn timestamped_log_path_uses_creation_timestamp() {
        let path = timestamped_log_path(Path::new("log"), "20260630-153000");

        assert_eq!(path, Path::new("log").join("20260630-153000.log"));
    }

    #[test]
    fn current_timestamp_format_is_readable_and_sortable() {
        assert_eq!(
            format_timestamp(std::time::Duration::from_millis(0)),
            "19700101-000000-000"
        );
        assert_eq!(
            format_timestamp(std::time::Duration::from_millis(1_709_164_800_123)),
            "20240229-000000-123"
        );
    }

    #[test]
    fn creating_new_log_keeps_only_three_timestamped_logs() {
        let dir = test_dir("prune");
        fs::create_dir_all(&dir).expect("test log directory should be created");
        write_sized_file(&dir.join("1000.log"), 1);
        write_sized_file(&dir.join("2000.log"), 1);
        write_sized_file(&dir.join("3000.log"), 1);

        let settings = LogSettings {
            directory: dir.clone(),
            max_file_bytes: 10,
            max_files: 3,
        };

        let state = open_new_log_file(&settings, "4000").expect("new log file should open");

        assert_eq!(state.path, dir.join("4000.log"));
        assert!(!dir.join("1000.log").exists());
        assert!(dir.join("2000.log").exists());
        assert!(dir.join("3000.log").exists());
        assert!(dir.join("4000.log").exists());

        fs::remove_dir_all(&dir).expect("test log directory should be removable");
    }

    #[test]
    fn writer_rotates_after_size_limit_and_deletes_oldest_full_log() {
        let dir = test_dir("rotate");
        fs::create_dir_all(&dir).expect("test log directory should be created");
        write_sized_file(&dir.join("1000.log"), 10);
        write_sized_file(&dir.join("2000.log"), 10);

        let timestamps = Arc::new(Mutex::new(vec!["3000".to_string(), "4000".to_string()]));
        let timestamp_source = {
            let timestamps = Arc::clone(&timestamps);
            move || timestamps.lock().expect("timestamps lock").remove(0)
        };

        let mut writer = RollingLogFile::new(
            LogSettings {
                directory: dir.clone(),
                max_file_bytes: 10,
                max_files: 3,
            },
            timestamp_source,
        )
        .expect("rolling log file should initialize");

        writer
            .write_all(b"12345")
            .expect("first log write should succeed");
        writer
            .write_all(b"678901")
            .expect("second log write should rotate");

        assert!(!dir.join("1000.log").exists());
        assert!(dir.join("2000.log").exists());
        assert!(dir.join("3000.log").exists());
        assert!(dir.join("4000.log").exists());
        assert_eq!(
            fs::read_to_string(dir.join("4000.log")).expect("rotated log should be readable"),
            "678901"
        );

        fs::remove_dir_all(&dir).expect("test log directory should be removable");
    }
}
