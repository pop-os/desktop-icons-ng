/* ADIEU: Another Desktop Icons Extension for GNOME Shell
 *
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
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
const Meta = imports.gi.Meta;

const Layout = imports.ui.layout;
const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Mainloop = imports.mainloop;

//const appSys = Shell.AppSystem.get_default();

let data = {};

function replaceMethod(className, methodName, functionToCall, classId) {
    if (classId) {
        data["old_" + classId + "_" + methodName] = className.prototype[methodName];
    } else {
        data["old_" + methodName] = className.prototype[methodName];
    }
    className.prototype[methodName] = functionToCall;
}

function init() {
    data.isEnabled = false;
    data.launchDesktopId = 0;
    data.currentProcess = null;
    data.reloadTime = 100;
    replaceMethod(Meta.Display, "get_tab_list", newGetTabList);
    replaceMethod(Shell.Global, "get_window_actors", newGetWindowActors);
    replaceMethod(Meta.Workspace, "list_windows", newListWindows);
    // Ensure that there aren't "rogue" processes
    doKillAllOldDesktopProcesses();
}

function removeDesktopWindowFromList(windowList, areActors) {

    if (!data.isEnabled) {
        return windowList;
    }
    let returnVal = [];
    for(let window of windowList) {
        let title;
        if (areActors) {
            title = window.get_meta_window().get_title();
        } else {
            title = window.get_title();
        }
        if (title != data.appUUID) {
            returnVal.push(window);
        }
    }
    return returnVal;
}

function newGetTabList(type, workspace) {
    let windowList = data.old_get_tab_list.apply(this, [type, workspace]);
    return removeDesktopWindowFromList(windowList, false);
};

function newGetWindowActors() {
    let windowList = data.old_get_window_actors.apply(this, []);
    return removeDesktopWindowFromList(windowList, true);
}

function newListWindows() {
    let windowList = data.old_list_windows.apply(this, []);
    return removeDesktopWindowFromList(windowList, false);
};

function enable() {
    if (Main.layoutManager._startingUp)
        data.startupPreparedId = Main.layoutManager.connect('startup-complete', () => innerEnable());
    else
        innerEnable();
}

function innerEnable() {

    if (data.startupPreparedId) {
        Main.layoutManager.disconnect(data.startupPreparedId);
        data.startupPreparedId = 0;
    }

    data.idMap = global.window_manager.connect('map', (obj, windowActor) => {
        let window = windowActor.get_meta_window();
        if (!data.windowUpdated) {
            window.move_resize_frame(false, data.minx, data.miny, data.maxx - data.minx, data.maxy - data.miny);
            window.stick();
            window.lower();
            data.windowUpdated = true;
            // keep the window at the bottom
            window.connect_after('raised', () => {
                window.lower();
            });
        }
        return false;
    });

    try {
        data.monitorsChangedId = Main.layoutManager.connect_after('monitors-changed', () => {
            data.reloadTime = 1000; // give more time in this case, to ensure that everything has changed
            killCurrentProcess();
        });
    } catch(e) {
        // compatibility with 3.30
        data.monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => {
            data.reloadTime = 2000; // give more time in this case, to ensure that everything has changed
            killCurrentProcess();
        });
    }
    data.isEnabled = true;
    launchDesktop();
}

function disable() {
    data.isEnabled = false;
    if (data.startupPreparedId)
        Main.layoutManager.disconnect(data.startupPreparedId);
    if (data.idMap)
        global.window_manager.disconnect(data.idMap);
    if (data.monitorsChangedId)
        Main.layoutManager.disconnect(data.monitorsChangedId);
    killCurrentProcess();
}

function killCurrentProcess() {
    if (data.launchDesktopId) {
        GLib.source_remove(data.launchDesktopId);
        data.launchDesktopId = 0;
        if (data.isEnabled) {
            data.launchDesktopId = Mainloop.timeout_add(data.reloadTime, () => {
                data.launchDesktopId = 0;
                launchDesktop();
            });
        }
    }

    if (data.currentProcess) {
        data.currentProcess.force_exit();
    }
}

function doKillAllOldDesktopProcesses() {
    /**
     * This function checks all the processes in the system and kills those
     * that are a desktop manager. This allows to avoid having several ones in
     * case gnome shell resets, or other cases.
     *
     * It requires the /proc virtual filesystem
     */

    let procFolder = Gio.File.new_for_path("/proc");
    if (!procFolder.query_exists(null)) {
        return;
    }
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
        let path = "/usr/bin/gjs " + GLib.build_filenamev([ExtensionUtils.getCurrentExtension().path, 'adieu.js']);
        if (("" + contents).startsWith(path)) {
            let proc = new Gio.Subprocess({argv: ['/bin/kill', filename]});
            proc.init(null);
            proc.wait(null);
        }
    }
}

function launchDesktop() {

    data.reloadTime = 100;
    let argv = [];
    argv.push(GLib.build_filenamev([ExtensionUtils.getCurrentExtension().path, 'adieu.js']));
    argv.push("-P");
    argv.push(ExtensionUtils.getCurrentExtension().path);

    let first = true;

    for(let monitorIndex = 0; monitorIndex < Main.layoutManager.monitors.length; monitorIndex++) {
        let ws = global.workspace_manager.get_workspace_by_index(0);
        let area = ws.get_work_area_for_monitor(monitorIndex);
        argv.push("-D");
        argv.push(area.x + ";" + area.y+";" + area.width + ";" + area.height);
        if (first || (area.x < data.minx)) {
            data.minx = area.x;
        }
        if (first || (area.y < data.miny)) {
            data.miny = area.y;
        }
        if (first || ((area.x + area.width) > data.maxx)) {
            data.maxx = area.x + area.width;
        }
        if (first || ((area.y + area.height) > data.maxy)) {
            data.maxy = area.y + area.height;
        }
        first = false;
    }

    data.windowUpdated = false;
    data.appUUID = GLib.uuid_string_random();
    let launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE});
    launcher.set_cwd(ExtensionUtils.getCurrentExtension().path);
    data.currentProcess = launcher.spawnv(argv);
    data.currentProcess.communicate_async(GLib.Bytes.new(data.appUUID + "\n"), null, (object, res) => {
        try {
            let [available, stdout, stderr] = object.communicate_finish(res);
            if (stdout.length != 0) {
                global.log("ADIEU: " + String.fromCharCode.apply(null, stdout.get_data()));
            }
        } catch(e) {
            global.log("Error " + e);
        }
    });
    //appPid = Number(_currentProcess.get_identifier());
    data.currentProcess.wait_async(null, () => {
        if (data.currentProcess.get_if_exited()) {
            let retval = data.currentProcess.get_exit_status();
            if (retval != 0) {
                data.reloadTime = 1000;
            }
        }
        data.currentProcess = null;
        if (data.isEnabled) {
            if (data.launchDesktopId) {
                GLib.source_remove(data.launchDesktopId);
            }
            data.launchDesktopId = Mainloop.timeout_add(data.reloadTime, () => {
                data.launchDesktopId = 0;
                launchDesktop();
            });
        }
    });
}
