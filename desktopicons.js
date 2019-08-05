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

imports.gi.versions.Gtk = '3.0';

var extensionPath = '.';
imports.searchPath.unshift(extensionPath);

const Prefs = imports.prefs;
const DBusUtils = imports.dbusUtils;

var Extension = {};

const DesktopManager = imports.desktopManager;

DBusUtils.init();
Prefs.init(extensionPath);

Extension.desktopManager = new DesktopManager.DesktopManager([{x:0, y:0, w: 800, h: 1050}, {x:810, y:0, w: 810, h: 600}], 1.0);
Extension.desktopManager.run();
