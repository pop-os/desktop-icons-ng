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
const St = imports.gi.St;

const Layout = imports.ui.layout;
const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Mainloop = imports.mainloop;

// This object will contain all the global variables
let data = {};

/**
 * Replaces a method in a class with out own method, and stores the original
 * one in 'data' using 'old_XXXX' (being XXXX the name of the original method),
 * or 'old_classId_XXXX' if 'classId' is defined. This is done this way for the
 * case that two methods with the same name must be replaced in two different
 * classes
 *
 * @param {class} className The class where to replace the method
 * @param {string} methodName The method to replace
 * @param {function} functionToCall The function to call as the replaced method
 * @param {string} [classId] an extra ID to identify the stored method when two
 *                           methods with the same name are replaced in
 *                           two different classes
 */
function replaceMethod(className, methodName, functionToCall, classId) {
    if (classId) {
        data['old_' + classId + '_' + methodName] = className.prototype[methodName];
    } else {
        data['old_' + methodName] = className.prototype[methodName];
    }
    className.prototype[methodName] = functionToCall;
}

function init() {
    data.isEnabled = false;
    data.launchDesktopId = 0;
    data.currentProcess = null;
    data.desktopWindow = null;
    data.reloadTime = 100;
    replaceMethod(Meta.Display, 'get_tab_list', newGetTabList);
    replaceMethod(Shell.Global, 'get_window_actors', newGetWindowActors);
    replaceMethod(Meta.Workspace, 'list_windows', newListWindows);
    // Ensure that there aren't "rogue" processes
    doKillAllOldDesktopProcesses();
}

/**
 * Receives a list of metaWindow or metaWindowActor objects, and remove from it
 * our desktop window
 *
 * @param {GList} windowList A list of metaWindow or metaWindowActor objects
 * @returns {GList} The same list, but with the desktop window removed
 */
function removeDesktopWindowFromList(windowList) {

    /*
     * Although the Gnome documentation says that a replaced method must be
     * restored when the extension is disabled, it is a very risky operation,
     * because if another extension also replaces the same methods, when this
     * extension is disabled the other one will fail.
     *
     * The secure way of doing a method replacement is to make it inalterable,
     * and just return the value of the old method without altering it when the
     * extension is disabled.
     */
    if (!data.isEnabled) {
        return windowList;
    }
    let returnVal = [];
    for(let window of windowList) {
        let title;
        if (window.get_meta_window) { // it is a MetaWindowActor
            title = window.get_meta_window().get_title();
        } else { // it is a MetaWindow
            title = window.get_title();
        }
        if (title != data.appUUID) {
            returnVal.push(window);
        }
    }
    return returnVal;
}

/**
 * Method replacement for Meta.Display.get_tab_list
 * It removes the desktop window from the list of windows in the switcher
 *
 * @param {*} type
 * @param {*} workspace
 */
function newGetTabList(type, workspace) {
    let windowList = data.old_get_tab_list.apply(this, [type, workspace]);
    return removeDesktopWindowFromList(windowList);
};

/**
 * Method replacement for Shell.Global.get_window_actors
 * It removes the desktop window from the list of windows in the Activities mode
 */
function newGetWindowActors() {
    let windowList = data.old_get_window_actors.apply(this, []);
    return removeDesktopWindowFromList(windowList);
}

/**
 * Method replacement for Meta.Workspace.list_windows
 */
function newListWindows() {
    let windowList = data.old_list_windows.apply(this, []);
    return removeDesktopWindowFromList(windowList);
};

/**
 * Enables the extension
 */
function enable() {
    // If the desktop is still starting up, we wait until it is ready
    if (Main.layoutManager._startingUp)
        data.startupPreparedId = Main.layoutManager.connect('startup-complete', () => innerEnable());
    else
        innerEnable();
}

/**
 * The true code that configures everything and launches the desktop program
 */
function innerEnable() {

    if (data.startupPreparedId) {
        Main.layoutManager.disconnect(data.startupPreparedId);
        data.startupPreparedId = 0;
    }

    data.idMap = global.window_manager.connect('map', (obj, windowActor) => {
        let window = windowActor.get_meta_window();
        if (!data.windowUpdated && (window.get_title() == data.appUUID)) {
            /*
             * the desktop window is big enough to cover all the monitors in the system,
             * so the first thing to do is to move it to the minimum coordinate of the desktop.
             *
             * In theory, the minimum coordinates are always (0,0); but if there is only one
             * monitor, the coordinates used are (0,27) because the top bar uses that size, and
             * it makes no sense in having a piece of window always covered by the bar. Of
             * course, that value isn't fixed, but calculated automatically each time the
             * desktop geometry changes, so a bigger top bar will work fine.
             */
            window.move_frame(false,
                              data.minx,
                              data.miny);
            // Show the window in all desktops, and send it to the bottom
            window.stick();
            window.lower();
            data.windowUpdated = true;
            data.desktopWindow = window;
            // keep the window at the bottom when the user clicks on it
            window.connect_after('raised', () => {
                window.lower();
            });
            window.connect('position-changed', () => {
                window.move_frame(false,
                data.minx,
                data.miny);
            });
            window.connect('unmanaged', () => {
                data.desktopWindow = null;
                data.windowUpdated = false;
            });
        }
        return false;
    });

    /*
     * If the desktop geometry changes (because a new monitor has been added, for example),
     * we kill the desktop program. It will be relaunched automatically with the new geometry,
     * thus adapting to it on-the-fly.
     */
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
    data.switchWorkspaceId = global.window_manager.connect('switch-workspace', () => {
        if (data.desktopWindow) {
            data.desktopWindow.lower();
        }
    });
    data.isEnabled = true;
    launchDesktop();
}

/**
 * Disables the extension
 */
function disable() {
    data.isEnabled = false;
    if (data.switchWorkspaceId)
        global.window_manager.disconnect(data.switchWorkspaceId);
    if (data.startupPreparedId)
        Main.layoutManager.disconnect(data.startupPreparedId);
    if (data.idMap)
        global.window_manager.disconnect(data.idMap);
    if (data.monitorsChangedId)
        Main.layoutManager.disconnect(data.monitorsChangedId);
    killCurrentProcess();
}

/**
 * Kills the current desktop program
 */
function killCurrentProcess() {
    // If a reload was pending, kill it and program a new reload
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

    // kill the desktop program. It will be reloaded automatically.
    data.desktopWindow = null;
    if (data.currentProcess) {
        data.currentProcess.force_exit();
    }
}

/**
 * This function checks all the processes in the system and kills those
 * that are a desktop manager. This allows to avoid having several ones in
 * case gnome shell resets, or other odd cases. It requires the /proc virtual
 * filesystem, but doesn't fail if it doesn't exist.
 */

function doKillAllOldDesktopProcesses() {

    let procFolder = Gio.File.new_for_path('/proc');
    if (!procFolder.query_exists(null)) {
        return;
    }

    let fileEnum = procFolder.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
    let info;
    while ((info = fileEnum.next_file(null))) {
        let filename = info.get_name();
        if (!filename) {
            break;
        }
        let processPath = GLib.build_filenamev(['/proc', filename, 'cmdline']);
        let processUser = Gio.File.new_for_path(processPath);
        if (!processUser.query_exists(null)) {
            continue;
        }
        let [data, etag] = processUser.load_bytes(null);
        let contents = '';
        data = data.get_data();
        for (let i = 0; i < data.length; i++) {
            if (data[i] < 32) {
                contents += ' ';
            } else {
                contents += String.fromCharCode(data[i]);
            }
        }
        let path = '/usr/bin/gjs ' + GLib.build_filenamev([ExtensionUtils.getCurrentExtension().path, 'adieu.js']);
        if (('' + contents).startsWith(path)) {
            let proc = new Gio.Subprocess({argv: ['/bin/kill', filename]});
            proc.init(null);
            proc.wait(null);
        }
    }
}

/**
 * Launches the desktop program, passing to it the current desktop geometry for each monitor
 * and the path where it is stored. It also monitors it, to relaunch it in case it dies or is
 * killed. Finally, it reads STDOUT and STDERR and redirects them to the journal, to help to
 * debug it.
 */
function launchDesktop() {

    data.reloadTime = 100;
    let argv = [];
    argv.push(GLib.build_filenamev([ExtensionUtils.getCurrentExtension().path, 'adieu.js']));
    // Specify that we are going to pass an UUID through STDIN
    argv.push('-U');
    // The path. Allows the program to find translations, settings and modules.
    argv.push('-P');
    argv.push(ExtensionUtils.getCurrentExtension().path);

    let first = true;

    for(let monitorIndex = 0; monitorIndex < Main.layoutManager.monitors.length; monitorIndex++) {
        let ws = global.workspace_manager.get_workspace_by_index(0);
        let area = ws.get_work_area_for_monitor(monitorIndex);
        // send the working area of each monitor in the desktop
        argv.push('-D');
        argv.push(area.x + ';' + area.y+';' + area.width + ';' + area.height);
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

    let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    argv.push('-Z');
    argv.push(scaleFactor.toString());

    data.windowUpdated = false;
    /*
     * Generate a random UUID to allow the extension to identify the window. It must be random
     * to avoid other programs to cheat and put themselves as the desktop. This also means that
     * launching the desktop program from the command line won't put that instance as the desktop,
     * but will work like any other program. Of course, under X11 it doesn't matter, but it does
     * under Wayland.
     */
    data.appUUID = GLib.uuid_string_random();
    let launcher = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.STDIN_PIPE |
                                                      Gio.SubprocessFlags.STDOUT_PIPE |
                                                      Gio.SubprocessFlags.STDERR_MERGE});
    launcher.set_cwd(ExtensionUtils.getCurrentExtension().path);
    data.currentProcess = launcher.spawnv(argv);
    /*
     * Send the UUID to the application using STDIN as a "secure channel". Sending it as a parameter
     * would be insecure, because another program could read it and create a window before our desktop,
     * and cheat the extension.
     *
     * It also reads STDOUT and STDERR and sends it to the journal using global.log(). This allows to
     * have any error from the desktop app in the same journal than other extensions. Every line from
     * the desktop program is prepended with "ADIEU: " (Another Desktop Icon Extension)
     */
    data.currentProcess.communicate_async(GLib.Bytes.new(data.appUUID + '\n'), null, (object, res) => {
        try {
            let [available, stdout, stderr] = object.communicate_finish(res);
            if (stdout.length != 0) {
                global.log('ADIEU: ' + String.fromCharCode.apply(null, stdout.get_data()));
            }
        } catch(e) {
            global.log('ADIEU_Error ' + e);
        }
    });
    //appPid = Number(_currentProcess.get_identifier());
    /*
     * If the desktop process dies, wait 100ms and relaunch it, unless the exit status is different than
     * zero, in which case it will wait one second. This is done this way to avoid relaunching the desktop
     * too fast if it has a bug that makes it fail continuously, avoiding filling the journal too fast.
     */
    data.currentProcess.wait_async(null, () => {
        if (data.currentProcess.get_if_exited()) {
            let retval = data.currentProcess.get_exit_status();
            if (retval != 0) {
                data.reloadTime = 1000;
            }
        }
        data.desktopWindow = null;
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
