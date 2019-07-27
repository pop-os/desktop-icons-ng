#!/usr/bin/gjs

/* Desktop Icons GNOME Shell extension
 *
 * Copyright (C) 2017 Carlos Soriano <csoriano@redhat.com>
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

// this allows to import files from the current folder

var imported = false;

var extensionPath = '.';

imports.searchPath.unshift(extensionPath);

imports.gi.versions.Gtk = '3.0';
imports.gi.versions.Cogl = '2.0';

const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;

const Prefs = imports.prefs;
const Fileitem = imports.fileItem;
const DesktopGrid = imports.desktopGrid;
const DBusUtils = imports.dbusUtils;
const DesktopIconsUtil = imports.desktopIconsUtil;

var Extension = {};

const TmpDM = imports.tmpDesktopManager;
Extension.desktopManager = new TmpDM.DesktopManager();

Gtk.init(null);

DBusUtils.init();
Prefs.init(extensionPath);

let desktopDir = DesktopIconsUtil.getDesktopDir();
let fileList = desktopDir.enumerate_children(DesktopIconsUtil.DEFAULT_ATTRIBUTES, Gio.FileQueryInfoFlags.NONE, null);
let files = [];
let info = null;
while ((info = fileList.next_file(null))) {
    files.push(info);
}

let ventana = new Gtk.Window();
let escroll = Gtk.ScrolledWindow.new(null, null);
ventana.add(escroll);
let contenedor = new Gtk.Fixed();

escroll.add(contenedor);

let grid = new DesktopGrid.DesktopGrid(0, 0, 900, 800);

contenedor.put(grid.actor, 0, 0);

for (let f of files) {
    let icon = new Fileitem.FileItem(Extension, fileList.get_child(f), f, Prefs.FileType.NONE);
    let itemX = 0;
    let itemY = 0;
    let coordinatesAction = DesktopGrid.StoredCoordinates.ASSIGN;
    if (icon.savedCoordinates != null) {
        [itemX, itemY] = icon.savedCoordinates;
        coordinatesAction = DesktopGrid.StoredCoordinates.PRESERVE;
    }
    print(icon.file.get_uri());
    grid.addFileItemCloseTo(icon, itemX, itemY, coordinatesAction);
}

ventana.show_all();

Gtk.main();
