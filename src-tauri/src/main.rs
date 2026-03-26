#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// Prevents additional console window on Windows in release
// DO NOT REMOVE!!
#![allow(unused_imports)]

fn main() {
    hdr_toolbox_lib::run()
}
