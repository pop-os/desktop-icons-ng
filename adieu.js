#!/usr/bin/gjs

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

imports.gi.versions.Gtk = '3.0';
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

let stdin = new Gio.DataInputStream({
    base_stream: new Gio.UnixInputStream({ fd: 0 })
});


let appUuid = String.fromCharCode.apply(null, stdin.read_line(null)[0]);
print(appUuid);

let desktops = [];
let lastCommand = null;
let codePath = '.';
let error = false;
let zoom = 1.0;
for(let arg of ARGV) {
    if (lastCommand == null) {
        switch(arg) {
        case '-P':
        case '-D':
        case '-Z':
            lastCommand = arg;
            break;
        default:
            print("Parameter not recognized. Aborting.");
            error = true;
            break;
        }
        continue;
    }
    if (error) {
        break;
    }
    switch(lastCommand) {
    case '-P':
        codePath = arg;
        break;
    case '-D':
        let data = arg.split(";");
        desktops.push({x:parseInt(data[0]), y:parseInt(data[1]), w:parseInt(data[2]), h:parseInt(data[3])});
        break;
    case '-Z':
        zoom = parseFloat(arg);
        break;
    }
    lastCommand = null;
}

// this allows to import files from the current folder

imports.searchPath.unshift(codePath);

const Prefs = imports.prefs;
const Gettext = imports.gettext;

Gettext.bindtextdomain("adieu", GLib.build_filenamev([codePath, "locale"]));

var Extension = {};

const DesktopManager = imports.desktopManager;

Prefs.init(codePath);

Extension.desktopManager = new DesktopManager.DesktopManager(appUuid, desktops, zoom, codePath);
Gtk.main();
