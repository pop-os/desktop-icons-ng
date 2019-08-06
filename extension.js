/* Desktop Icons NG GNOME Shell extension
 *
 * Copyright (C) 2019 Sergio Costas Rodriguez
 *
 * Based on code original from (C) 2017 Carlos Soriano
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Shell = imports.gi.Shell;
const Layout = imports.ui.layout;
const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;

let appPid;
let minx;
let miny;
let maxx;
let maxy;

let isEnabled;

let idMap;
let _monitorsChangedId;
let _startupPreparedId;
let _thumbnailScriptWatch;
let _launchDesktopId;
let _killAllInstancesId;
let _currentProcess;

const appSys = Shell.AppSystem.get_default();

function init() {
    isEnabled = false;
    _thumbnailScriptWatch = 0;
    _launchDesktopId = 0;
    _killAllInstancesId = 0;
    _currentProcess = null;
    // Ensure that there aren't "rogue" processes
    doKillAllOldDesktopProcesses();
}

function enable() {
    if (Main.layoutManager._startingUp)
        _startupPreparedId = Main.layoutManager.connect('startup-complete', () => innerEnable(true));
    else
        innerEnable(false);
}

function innerEnable(disconnectSignal) {
    if (disconnectSignal)
        Main.layoutManager.disconnect(_startupPreparedId);
    idMap = global.window_manager.connect('map', (ev1, ev2, ev3) => {
        for(let windowActor of global.get_window_actors()) {
            let window = windowActor.get_meta_window();
            let pid = window.get_pid();
            if (pid == appPid) {
                global.log("Es el PID buscado " + pid);
                window.move_resize_frame(false, minx, miny, maxx - minx, maxy - miny);
                window.stick();
            }
        }
    });
    _monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => {
        killCurrentProcess();
    });
    isEnabled = true;
    launchDesktop();
}

function disable() {
    isEnabled = false;
    killCurrentProcess();
    global.window_manager.disconnect(idMap);
    Main.layoutManager.disconnect(_monitorsChangedId);
}

function killCurrentProcess() {

    if (_launchDesktopId) {
        GLib.source_remove(_launchDesktopId);
        if (isEnabled) {
            _launchDesktopId = Mainloop.timeout_add(1000, () => {
                _launchDesktopId = 0;
                launchDesktop();
            });
        }
    }

    if (_currentProcess) {
        _currentProcess.force_exit();
        _currentProcess = null;
    }
}

function doKillAllOldDesktopProcesses() {
    /**
     * This function checks all the processes in the system and kills those
     * that are a desktop manager. This allows to avoid having several ones in
     * case gnome shell resets, or other cases.
     */

    let procFolder = Gio.File.new_for_path("/proc");
    let fileEnum = procFolder.enumerate_children("", Gio.FileQueryInfoFlags.NONE, null);
    let info;
    while ((info = fileEnum.next_file(null))) {
        let filename = info.get_name();
        let processUser = Gio.File.new_for_path("/proc/" + filename + "/cmdline");
        if (!processUser.query_exists(null)) {
            continue;
        }
        let [data, etag] = processUser.load_bytes(null);
        let contents = "";
        data = data.get_data();
        for (let i = 0; i < data.length; i++) {
            if (data[i] < 32) {
                contents += ' ';
            } else {
                contents += String.fromCharCode(data[i]);
            }
        }
        let path = "/usr/bin/gjs " + GLib.build_filenamev([ExtensionUtils.getCurrentExtension().path, 'desktopiconsng.js']);
        if (("" + contents).startsWith(path)) {
            let proc = new Gio.Subprocess({argv: ['/bin/kill', filename]});
            proc.init(null);
            proc.wait(null);
        }
    }
}

function launchDesktop() {

    let argv = [];
    argv.push(GLib.build_filenamev([ExtensionUtils.getCurrentExtension().path, 'desktopiconsng.js']));
    argv.push("-P");
    argv.push(ExtensionUtils.getCurrentExtension().path);

    let first = true;

    for(let monitorIndex = 0; monitorIndex < Main.layoutManager.monitors.length; monitorIndex++) {
        let ws = global.workspace_manager.get_workspace_by_index(0);
        let area = ws.get_work_area_for_monitor(monitorIndex);
        argv.push("-D");
        argv.push(area.x + ";" + area.y+";" + area.width + ";" + area.height);
        if (first || (area.x < minx)) {
            minx = area.x;
        }
        if (first || (area.y < miny)) {
            miny = area.y;
        }
        if (first || ((area.x + area.width) < maxx)) {
            maxx = area.x + area.width;
        }
        if (first || ((area.y + area.height) < maxy)) {
            maxy = area.y + area.height;
        }
        first = false;
    }

    let launcher = new Gio.SubprocessLauncher();
    launcher.set_cwd(ExtensionUtils.getCurrentExtension().path);
    _currentProcess = launcher.spawnv(argv);
    appPid = Number(_currentProcess.get_identifier());
    _currentProcess.wait_async(null, () => {
        _currentProcess = null;
        appPid = 0;
        if (isEnabled) {
            if (_launchDesktopId) {
                GLib.source_remove(_launchDesktopId);
            }
            _launchDesktopId = Mainloop.timeout_add(1000, () => {
                _launchDesktopId = 0;
                launchDesktop();
            });
        }
    });
}
