#!/usr/bin/env gjs

/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

imports.gi.versions.Gtk = '3.0';
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

let appUuid = null;

let desktops = [];
let lastCommand = null;
let codePath = '.';
let errorFound = false;
let asDesktop = false;
for(let arg of ARGV) {
    if (lastCommand == null) {
        switch(arg) {
        case '-E':
            // run it as a true desktop (transparent window and so on)
            asDesktop = true;
            break;
        case '-U':
            // wait for an UUID from STDIN
            let stdin = new Gio.DataInputStream({
                base_stream: new Gio.UnixInputStream({ fd: 0 })
            });
            appUuid = String.fromCharCode.apply(null, stdin.read_line(null)[0]);
            stdin.close(null);
            break;
        case '-P':
        case '-D':
            lastCommand = arg;
            break;
        default:
            print(`Parameter ${arg} not recognized. Aborting.`);
            errorFound = true;
            break;
        }
        continue;
    }
    if (errorFound) {
        break;
    }
    switch(lastCommand) {
    case '-P':
        codePath = arg;
        break;
    case '-D':
        let data = arg.split(":");
        desktops.push({x:parseInt(data[0]), y:parseInt(data[1]), width:parseInt(data[2]), height:parseInt(data[3]), zoom:parseInt(data[4])});
        break;
    }
    lastCommand = null;
}

if (desktops.length == 0) {
    /* if no desktop list is provided, like when launching the program in stand-alone mode,
     * configure a 1280x720 desktop
     */
    desktops.push({x:0, y:0, width: 1280, height: 720, zoom: 1});
}

// this allows to import files from the current folder

imports.searchPath.unshift(codePath);

const Prefs = imports.preferences;
const Gettext = imports.gettext;

Gettext.bindtextdomain("ding", GLib.build_filenamev([codePath, "locale"]));

const DesktopManager = imports.desktopManager;

var desktopManager;

class DesktopApp {
    constructor() {
        this._windowGroup = new Gtk.WindowGroup();
        this._application = new Gtk.Application({
            application_id: 'com.rastersoft.ding',
            flags: Gio.ApplicationFlags.FLAGS_NONE
        });
        this._application.connect('startup', this._startup.bind(this));
        this._application.connect('activate', this._activate.bind(this));
        this._application.connect('shutdown', this._shutdown.bind(this));
    }

    run() {
        this._application.run(null);
    }

    _startup() {
        Prefs.init(codePath);
        this._desktopManager = new DesktopManager.DesktopManager(this, appUuid, desktops, codePath, asDesktop);
    }

    _activate() {
    }

    _shutdown() {
    }

    hold() {
        this._application.hold();
    }

    release() {
        this._application.release();
    }
    newWindow(params) {
        params.application = this._application;
        let window = new Gtk.ApplicationWindow(params);
        this._windowGroup.add_window(window);
        return window;
    }
}

if (errorFound) {
    1;
} else {
    var desktopIconsApplication = new DesktopApp();
    desktopIconsApplication.run();
}
