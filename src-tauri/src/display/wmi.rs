//! Internal display WMI brightness provider.
#![allow(dead_code)]

use super::DisplayError;

#[cfg(windows)]
use windows::{
    core::{BSTR, GUID, PCWSTR},
    Win32::{
        Foundation::RPC_E_CHANGED_MODE,
        System::{
            Com::{
                CoCreateInstance, CoInitializeEx, CoSetProxyBlanket, CoUninitialize,
                CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED, EOAC_NONE, RPC_C_AUTHN_LEVEL_CALL,
                RPC_C_IMP_LEVEL_IMPERSONATE,
            },
            Variant::{VariantClear, VARIANT, VT_BSTR, VT_I4, VT_UI1, VT_UI4},
            Wmi::{
                IEnumWbemClassObject, IWbemClassObject, IWbemContext, IWbemLocator, IWbemServices,
                WBEM_FLAG_FORWARD_ONLY, WBEM_FLAG_RETURN_IMMEDIATELY,
                WBEM_FLAG_RETURN_WBEM_COMPLETE, WBEM_GENERIC_FLAG_TYPE, WBEM_INFINITE,
            },
        },
    },
};

#[cfg(windows)]
const CLSID_WBEM_LOCATOR: GUID = GUID::from_u128(0x4590f811_1d3a_11d0_891f_00aa004b2e24);
#[cfg(windows)]
const RPC_C_AUTHN_WINNT: u32 = 10;
#[cfg(windows)]
const RPC_C_AUTHZ_NONE: u32 = 0;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct WmiDisplay {
    pub key: String,
    pub name: String,
    pub brightness_percent: u32,
}

pub(super) fn enumerate_wmi_displays() -> Result<Vec<WmiDisplay>, DisplayError> {
    enumerate_wmi_displays_windows()
}

pub(super) fn set_wmi_brightness(key: &str, percent: u32) -> Result<(), DisplayError> {
    set_wmi_brightness_windows(key, percent)
}

pub(super) fn read_wmi_brightness(key: &str) -> Result<WmiDisplay, DisplayError> {
    read_wmi_brightness_windows(key)
}

fn key_from_instance_name(instance_name: &str) -> Option<String> {
    let mut parts = instance_name.split('\\');
    let _display = parts.next()?;
    let _model = parts.next()?;
    let instance = parts.next()?;
    Some(instance.split('_').next().unwrap_or(instance).to_string())
}

fn clamp_wmi_brightness(value: u32) -> u32 {
    value.min(100)
}

#[cfg(windows)]
fn enumerate_wmi_displays_windows() -> Result<Vec<WmiDisplay>, DisplayError> {
    enumerate_wmi_displays_via_com().map_err(|error| {
        DisplayError::wmi_enumeration_failed(format!("WMI display enumeration failed: {error}"))
    })
}

#[cfg(not(windows))]
fn enumerate_wmi_displays_windows() -> Result<Vec<WmiDisplay>, DisplayError> {
    Err(DisplayError::wmi_enumeration_failed(
        "WMI provider requires Windows",
    ))
}

#[cfg(windows)]
fn set_wmi_brightness_windows(key: &str, percent: u32) -> Result<(), DisplayError> {
    set_wmi_brightness_via_com(key, percent).map_err(|error| {
        DisplayError::wmi_brightness_failed(format!("WmiSetBrightness failed for {key}: {error}"))
    })
}

#[cfg(not(windows))]
fn set_wmi_brightness_windows(key: &str, _percent: u32) -> Result<(), DisplayError> {
    Err(DisplayError::wmi_brightness_failed(format!(
        "WMI provider requires Windows for {key}"
    )))
}

#[cfg(windows)]
fn read_wmi_brightness_windows(key: &str) -> Result<WmiDisplay, DisplayError> {
    read_wmi_brightness_via_com(key).map_err(|error| {
        DisplayError::wmi_brightness_failed(format!(
            "WmiMonitorBrightness read failed for {key}: {error}"
        ))
    })
}

#[cfg(not(windows))]
fn read_wmi_brightness_windows(key: &str) -> Result<WmiDisplay, DisplayError> {
    Err(DisplayError::wmi_brightness_failed(format!(
        "WMI provider requires Windows for {key}"
    )))
}

#[cfg(windows)]
struct ComApartment {
    uninitialize_on_drop: bool,
}

#[cfg(windows)]
impl Drop for ComApartment {
    fn drop(&mut self) {
        if self.uninitialize_on_drop {
            unsafe { CoUninitialize() };
        }
    }
}

#[cfg(windows)]
struct WmiConnection {
    _apartment: ComApartment,
    services: IWbemServices,
}

#[cfg(windows)]
fn enumerate_wmi_displays_via_com() -> Result<Vec<WmiDisplay>, String> {
    let connection = connect_wmi()?;
    let objects = exec_query(
        &connection.services,
        "SELECT InstanceName, CurrentBrightness FROM WmiMonitorBrightness",
    )?;
    let mut displays = Vec::new();

    for object in objects {
        let Some(instance_name) = get_string_property(&object, "InstanceName")? else {
            continue;
        };
        let Some(current_brightness) = get_u32_property(&object, "CurrentBrightness")? else {
            continue;
        };

        displays.push(WmiDisplay {
            key: key_from_instance_name(&instance_name).unwrap_or(instance_name),
            name: "Internal Display".to_string(),
            brightness_percent: clamp_wmi_brightness(current_brightness),
        });
    }

    Ok(displays)
}

#[cfg(windows)]
fn read_wmi_brightness_via_com(key: &str) -> Result<WmiDisplay, String> {
    enumerate_wmi_displays_via_com()?
        .into_iter()
        .find(|display| display.key == key)
        .ok_or_else(|| "matching WmiMonitorBrightness instance not found".to_string())
}

#[cfg(windows)]
fn set_wmi_brightness_via_com(key: &str, percent: u32) -> Result<(), String> {
    let connection = connect_wmi()?;
    let Some(object_path) = find_wmi_brightness_methods_path(&connection.services, key)? else {
        return Err("matching WmiMonitorBrightnessMethods instance not found".to_string());
    };

    let mut class_object = None;
    unsafe {
        connection
            .services
            .GetObject(
                &BSTR::from("WmiMonitorBrightnessMethods"),
                WBEM_FLAG_RETURN_WBEM_COMPLETE,
                None::<&IWbemContext>,
                Some(&mut class_object),
                None,
            )
            .map_err(|error| format!("GetObject(WmiMonitorBrightnessMethods) failed: {error}"))?;
    }
    let class_object = class_object.ok_or("WmiMonitorBrightnessMethods class was not returned")?;

    let mut input_signature = None;
    let mut output_signature = None;
    unsafe {
        class_object
            .GetMethod(
                PCWSTR(wide_null_terminated("WmiSetBrightness").as_ptr()),
                0,
                &mut input_signature,
                &mut output_signature,
            )
            .map_err(|error| format!("GetMethod(WmiSetBrightness) failed: {error}"))?;
    }
    let input_signature = input_signature.ok_or("WmiSetBrightness input signature missing")?;
    let input_parameters = unsafe {
        input_signature
            .SpawnInstance(0)
            .map_err(|error| format!("SpawnInstance for WmiSetBrightness failed: {error}"))?
    };

    put_u32_property(&input_parameters, "Timeout", 0)?;
    put_u32_property(
        &input_parameters,
        "Brightness",
        clamp_wmi_brightness(percent),
    )?;

    unsafe {
        connection
            .services
            .ExecMethod(
                &BSTR::from(object_path),
                &BSTR::from("WmiSetBrightness"),
                WBEM_FLAG_RETURN_WBEM_COMPLETE,
                None::<&IWbemContext>,
                &input_parameters,
                None,
                None,
            )
            .map_err(|error| format!("ExecMethod(WmiSetBrightness) failed: {error}"))?;
    }

    Ok(())
}

#[cfg(windows)]
fn find_wmi_brightness_methods_path(
    services: &IWbemServices,
    key: &str,
) -> Result<Option<String>, String> {
    let objects = exec_query(
        services,
        "SELECT __PATH, InstanceName FROM WmiMonitorBrightnessMethods",
    )?;

    for object in objects {
        let Some(instance_name) = get_string_property(&object, "InstanceName")? else {
            continue;
        };
        let instance_key = key_from_instance_name(&instance_name).unwrap_or(instance_name.clone());

        if instance_key == key || instance_name == key {
            return get_string_property(&object, "__PATH");
        }
    }

    Ok(None)
}

#[cfg(windows)]
fn connect_wmi() -> Result<WmiConnection, String> {
    let apartment = initialize_com()?;
    let locator: IWbemLocator = unsafe {
        CoCreateInstance(&CLSID_WBEM_LOCATOR, None, CLSCTX_INPROC_SERVER)
            .map_err(|error| format!("CoCreateInstance(IWbemLocator) failed: {error}"))?
    };
    let services = unsafe {
        locator
            .ConnectServer(
                &BSTR::from("ROOT\\WMI"),
                &BSTR::new(),
                &BSTR::new(),
                &BSTR::new(),
                0,
                &BSTR::new(),
                None::<&IWbemContext>,
            )
            .map_err(|error| format!("ConnectServer(ROOT\\WMI) failed: {error}"))?
    };

    unsafe {
        CoSetProxyBlanket(
            &services,
            RPC_C_AUTHN_WINNT,
            RPC_C_AUTHZ_NONE,
            PCWSTR::null(),
            RPC_C_AUTHN_LEVEL_CALL,
            RPC_C_IMP_LEVEL_IMPERSONATE,
            None,
            EOAC_NONE,
        )
        .map_err(|error| format!("CoSetProxyBlanket failed: {error}"))?;
    }

    Ok(WmiConnection {
        _apartment: apartment,
        services,
    })
}

#[cfg(windows)]
fn initialize_com() -> Result<ComApartment, String> {
    let result = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
    com_apartment_from_initialize_result(result)
}

#[cfg(windows)]
fn com_apartment_from_initialize_result(
    result: windows::core::HRESULT,
) -> Result<ComApartment, String> {
    if result.is_ok() {
        return Ok(ComApartment {
            uninitialize_on_drop: true,
        });
    }

    if result == RPC_E_CHANGED_MODE {
        return Ok(ComApartment {
            uninitialize_on_drop: false,
        });
    }

    result
        .ok()
        .map(|_| ComApartment {
            uninitialize_on_drop: true,
        })
        .map_err(|error| format!("CoInitializeEx failed: {error}"))
}

#[cfg(windows)]
fn exec_query(services: &IWbemServices, query: &str) -> Result<Vec<IWbemClassObject>, String> {
    let flags = WBEM_GENERIC_FLAG_TYPE(WBEM_FLAG_FORWARD_ONLY.0 | WBEM_FLAG_RETURN_IMMEDIATELY.0);
    let enumerator: IEnumWbemClassObject = unsafe {
        services
            .ExecQuery(
                &BSTR::from("WQL"),
                &BSTR::from(query),
                flags,
                None::<&IWbemContext>,
            )
            .map_err(|error| format!("ExecQuery({query}) failed: {error}"))?
    };
    let mut objects = Vec::new();

    loop {
        let mut returned = 0;
        let mut batch = [None];
        let status = unsafe { enumerator.Next(WBEM_INFINITE, &mut batch, &mut returned) };
        if status.is_err() {
            return Err(format!("IEnumWbemClassObject::Next failed: {status:?}"));
        }
        if returned == 0 {
            break;
        }
        if let Some(object) = batch[0].take() {
            objects.push(object);
        }
    }

    Ok(objects)
}

#[cfg(windows)]
fn get_string_property(
    object: &IWbemClassObject,
    property: &str,
) -> Result<Option<String>, String> {
    let mut value = VARIANT::default();
    let property_name = wide_null_terminated(property);

    unsafe {
        object
            .Get(PCWSTR(property_name.as_ptr()), 0, &mut value, None, None)
            .map_err(|error| format!("IWbemClassObject::Get({property}) failed: {error}"))?;
    }

    let result = variant_to_string(&value);
    unsafe {
        VariantClear(&mut value)
            .map_err(|error| format!("VariantClear({property}) failed: {error}"))?;
    }
    Ok(result)
}

#[cfg(windows)]
fn get_u32_property(object: &IWbemClassObject, property: &str) -> Result<Option<u32>, String> {
    let mut value = VARIANT::default();
    let property_name = wide_null_terminated(property);

    unsafe {
        object
            .Get(PCWSTR(property_name.as_ptr()), 0, &mut value, None, None)
            .map_err(|error| format!("IWbemClassObject::Get({property}) failed: {error}"))?;
    }

    let result = variant_to_u32(&value);
    unsafe {
        VariantClear(&mut value)
            .map_err(|error| format!("VariantClear({property}) failed: {error}"))?;
    }
    Ok(result)
}

#[cfg(windows)]
fn put_u32_property(
    object: &IWbemClassObject,
    property: &str,
    property_value: u32,
) -> Result<(), String> {
    let mut value = variant_from_u32(property_value);
    let property_name = wide_null_terminated(property);

    unsafe {
        object
            .Put(PCWSTR(property_name.as_ptr()), 0, &value, 0)
            .map_err(|error| format!("IWbemClassObject::Put({property}) failed: {error}"))?;
        VariantClear(&mut value)
            .map_err(|error| format!("VariantClear({property}) failed: {error}"))?;
    }

    Ok(())
}

#[cfg(windows)]
fn variant_to_string(value: &VARIANT) -> Option<String> {
    let variant = unsafe { &value.Anonymous.Anonymous };
    if variant.vt != VT_BSTR {
        return None;
    }

    let bstr = unsafe { &*variant.Anonymous.bstrVal };
    String::try_from(bstr).ok()
}

#[cfg(windows)]
fn variant_to_u32(value: &VARIANT) -> Option<u32> {
    let variant = unsafe { &value.Anonymous.Anonymous };
    match variant.vt {
        vt if vt == VT_UI1 => Some(unsafe { variant.Anonymous.bVal as u32 }),
        vt if vt == VT_UI4 => Some(unsafe { variant.Anonymous.ulVal }),
        vt if vt == VT_I4 => Some(unsafe { variant.Anonymous.lVal.max(0) as u32 }),
        _ => None,
    }
}

#[cfg(windows)]
fn variant_from_u32(value: u32) -> VARIANT {
    let mut variant = VARIANT::default();
    unsafe {
        let variant_data = &mut *variant.Anonymous.Anonymous;
        variant_data.vt = VT_UI4;
        variant_data.Anonymous.ulVal = value;
    }
    variant
}

#[cfg(windows)]
fn wide_null_terminated(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn monitor_instance_name_key_strips_suffix() {
        let key = key_from_instance_name("DISPLAY\\BOE1234\\5&abc_0");
        assert_eq!(key.as_deref(), Some("5&abc"));
    }

    #[test]
    fn wmi_percent_is_clamped() {
        assert_eq!(clamp_wmi_brightness(140), 100);
        assert_eq!(clamp_wmi_brightness(42), 42);
    }

    #[cfg(windows)]
    #[test]
    fn com_initialization_accepts_existing_different_apartment() {
        let apartment = com_apartment_from_initialize_result(RPC_E_CHANGED_MODE)
            .expect("RPC_E_CHANGED_MODE should reuse the host COM apartment");

        assert!(!apartment.uninitialize_on_drop);
    }
}
