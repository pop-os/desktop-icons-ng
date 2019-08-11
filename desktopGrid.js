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

const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Prefs = imports.prefs;
const Enums = imports.enums;
const DesktopIconsUtil = imports.desktopIconsUtil;
const Signals = imports.signals;

const Gettext = imports.gettext.domain('adieu');

const _ = Gettext.gettext;


/* From NautilusFileUndoManagerState */
var UndoStatus = {
    NONE: 0,
    UNDO: 1,
    REDO: 2,
};

var elementSpacing = 4;

var DesktopGrid = class {

    constructor(desktopManager, container, x, y, width, height, minx, miny, scaleFactor) {

        this._desktopManager = desktopManager;
        this._x = x;
        this._y = y;
        this._minx = minx;
        this._miny = miny;
        this._width = width;
        this._height = height;
        this._container = container;
        this._maxColumns = Math.floor(this._width / (Prefs.get_desired_width(scaleFactor) + 2 * elementSpacing));
        this._maxRows =  Math.floor(this._height / (Prefs.get_desired_height(scaleFactor) + 2 * elementSpacing));
        this._elementWidth = Math.floor(this._width / this._maxColumns);
        this._elementHeight = Math.floor(this._height / this._maxRows);
        this._elementMarginH = this._elementWidth - Prefs.get_desired_width(scaleFactor) - elementSpacing;
        this._elementMarginV = this._elementHeight - Prefs.get_desired_height(scaleFactor) - elementSpacing;

        this._fileItems = [];

        this._gridStatus = {};
        for (let y=0; y<this._maxRows; y++) {
            for (let x=0; x<this._maxColumns; x++) {
                this._setGridUse(x, y, false);
            }
        }
    }

    getDistance(x, y) {
        /**
         * Checks if these coordinates belong to this grid.
         *
         * @Returns: -1 if there is no free space for new icons;
         *            0 if the coordinates are inside this grid;
         *            the distance to the middle point, if none of the previous
         */

         let isFree = false;
         for (let element in this._gridStatus) {
             if (this._gridStatus[element] == false) {
                 isFree = true;
                 break;
             }
         }
         if (!isFree) {
             return -1;
         }
         if ((x >= this._x) && (x < (this._x + this._width)) && (y >= this._y) && (y < (this._y + this._height))) {
             return 0;
         }
         return Math.pow(x - (this._x + this._width / 2), 2) + Math.pow(x - (this._y + this._height / 2), 2);
    }

    _onKeyPress(actor, event) {
        if (global.stage.get_key_focus() != actor)
            return false;

        let symbol = event.get_key_symbol();
        let isCtrl = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) != 0;
        let isShift = (event.get_state() & Clutter.ModifierType.SHIFT_MASK) != 0;
        if (isCtrl && isShift && [Clutter.Z, Clutter.z].indexOf(symbol) > -1) {
            this._doRedo();
            return true;
        }
        else if (isCtrl && [Clutter.Z, Clutter.z].indexOf(symbol) > -1) {
            this._doUndo();
            return true;
        }
        else if (isCtrl && [Clutter.C, Clutter.c].indexOf(symbol) > -1) {
            this._desktopManager.doCopy();
            return true;
        }
        else if (isCtrl && [Clutter.X, Clutter.x].indexOf(symbol) > -1) {
            this._desktopManager.doCut();
            return true;
        }
        else if (isCtrl && [Clutter.V, Clutter.v].indexOf(symbol) > -1) {
            this._doPaste();
            return true;
        }
        else if (symbol == Clutter.Return) {
            this._desktopManager.doOpen();
            return true;
        }
        else if (symbol == Clutter.Delete) {
            this._desktopManager.doTrash();
            return true;
        } else if (symbol == Clutter.F2) {
            // Support renaming other grids file items.
            this._desktopManager.doRename();
            return true;
        }
        return false;
    }

    _onOpenDesktopInFilesClicked() {
        Gio.AppInfo.launch_default_for_uri_async(DesktopIconsUtil.getDesktopDir().get_uri(),
            null, null,
            (source, result) => {
                try {
                    Gio.AppInfo.launch_default_for_uri_finish(result);
                } catch (e) {
                   log('Error opening Desktop in Files: ' + e.message);
                }
            }
        );
    }

    _onOpenTerminalClicked() {
        let desktopPath = DesktopIconsUtil.getDesktopDir().get_path();
        DesktopIconsUtil.launchTerminal(desktopPath);
    }

    _syncUndoRedo() {
        this._undoMenuItem.actor.visible = DBusUtils.NautilusFileOperationsProxy.UndoStatus == UndoStatus.UNDO;
        this._redoMenuItem.actor.visible = DBusUtils.NautilusFileOperationsProxy.UndoStatus == UndoStatus.REDO;
    }

    _undoStatusChanged(proxy, properties, test) {
        if ('UndoStatus' in properties.deep_unpack())
            this._syncUndoRedo();
    }

    _createDesktopBackgroundMenu() {
        /*let menu = new PopupMenu.PopupMenu(Main.layoutManager.dummyCursor,
                                           0, St.Side.TOP);
        menu.addAction(_("New Folder"), () => this._onNewFolderClicked());
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._pasteMenuItem = menu.addAction(_("Paste"), () => this._onPasteClicked());
        this._undoMenuItem = menu.addAction(_("Undo"), () => this._onUndoClicked());
        this._redoMenuItem = menu.addAction(_("Redo"), () => this._onRedoClicked());
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addAction(_("Show Desktop in Files"), () => this._onOpenDesktopInFilesClicked());
        menu.addAction(_("Open in Terminal"), () => this._onOpenTerminalClicked());
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addSettingsAction(_("Change Background…"), 'gnome-background-panel.desktop');
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        menu.addSettingsAction(_("Display Settings"), 'gnome-display-panel.desktop');
        menu.addSettingsAction(_("Settings"), 'gnome-control-center.desktop');

        menu.actor.add_style_class_name('background-menu');

        Main.layoutManager.uiGroup.add_child(menu.actor);
        menu.actor.hide();

        menu._propertiesChangedId = DBusUtils.NautilusFileOperationsProxy.connect('g-properties-changed',
            this._undoStatusChanged.bind(this));
        this._syncUndoRedo();

        menu.connect('destroy',
            () => DBusUtils.NautilusFileOperationsProxy.disconnect(menu._propertiesChangedId));
        menu.connect('open-state-changed',
            (popupm, isOpen) => {
                if (isOpen) {
                    Clipboard.get_text(CLIPBOARD_TYPE,
                        (clipBoard, text) => {
                            let [valid, is_cut, files] = this._parseClipboardText(text);
                            this._pasteMenuItem.setSensitive(valid);
                        }
                    );
                }
            }
        );
        this._pasteMenuItem.setSensitive(false);

        return menu;*/
    }

    _addFileItemTo(fileItem, column, row, coordinatesAction) {

        let x = this._x + this._elementWidth * column + this._elementMarginH - this._minx;
        let y = this._y + this._elementHeight * row + this._elementMarginV - this._miny;
        this._container.put(fileItem.actor, x, y);
        this._setGridUse(column, row, true);
        this._fileItems.push(fileItem);
        fileItem.setCoordinates(x,
                                y,
                                this._elementWidth - 2 * this._elementMarginH,
                                this._elementHeight - 2 * this._elementMarginV,
                                this);
        //let renameId = fileItem.connect('rename-clicked', this.doRename.bind(this));

        /* If this file is new in the Desktop and hasn't yet
         * fixed coordinates, store the new possition to ensure
         * that the next time it will be shown in the same possition.
         * Also store the new possition if it has been moved by the user,
         * and not triggered by a screen change.
         */
        if ((fileItem.savedCoordinates == null) || (coordinatesAction == Enums.StoredCoordinates.OVERWRITE)) {
            let fileX = this._x + Math.round((column * this._width) / this._maxColumns);
            let fileY = this._y + Math.round((row * this._height) / this._maxRows);
            fileItem.savedCoordinates = [fileX, fileY];
        }
    }

    addFileItemCloseTo(fileItem, x, y, coordinatesAction) {
        let [column, row] = this._getEmptyPlaceClosestTo(x, y, coordinatesAction);
        this._addFileItemTo(fileItem, column, row, coordinatesAction);
    }

    _isEmptyAt(x,y) {
        return !this._gridStatus[y * this._maxColumns + x];
    }

    _setGridUse(x, y, inUse) {
        this._gridStatus[y * this._maxColumns + x] = inUse;
    }

    _getEmptyPlaceClosestTo(x, y, coordinatesAction) {

        let placeX = Math.round((x - this._x) * this._maxColumns / this._width);
        let placeY = Math.round((y - this._y) * this._maxRows / this._height);

        placeX = DesktopIconsUtil.clamp(placeX, 0, this._maxColumns - 1);
        placeY = DesktopIconsUtil.clamp(placeY, 0, this._maxRows - 1);
        if (this._isEmptyAt(placeX, placeY)) {
            return [placeX, placeY];
        }
        let found = false;
        let resColumn = null;
        let resRow = null;
        let minDistance = Infinity;
        for (let column = 0; column < this._maxColumns; column++) {
            for (let row = 0; row < this._maxRows; row++) {
                if (!this._isEmptyAt(column, row)) {
                    continue;
                }

                let proposedX = this._x + Math.round((column * this._width) / this._maxColumns);
                let proposedY = this._y + Math.round((row * this._height) / this._maxRows);
                if (coordinatesAction == Enums.StoredCoordinates.ASSIGN)
                    return [column, row];
                let distance = DesktopIconsUtil.distanceBetweenPoints(proposedX, proposedY, x, y);
                if (distance < minDistance) {
                    found = true;
                    minDistance = distance;
                    resColumn = column;
                    resRow = row;
                }
            }
        }

        if (!found)
            throw new Error(`Not enough place at monitor`);

        return [resColumn, resRow];
    }

    _onPressButton(actor, event) {
        let button = event.get_button();
        let [x, y] = event.get_coords();

        if (button == 1) {
            let shiftPressed = !!(event.get_state() & Clutter.ModifierType.SHIFT_MASK);
            let controlPressed = !!(event.get_state() & Clutter.ModifierType.CONTROL_MASK);
            if (!shiftPressed && !controlPressed)
                this._desktopManager.clearSelection();
            let [gridX, gridY] = this._grid.get_transformed_position();
            this._desktopManager.startRubberBand(x, y, gridX, gridY);
            return true;
        }

        if (button == 3) {
            this._openMenu(x, y);

            return true;
        }

        return false;
    }
};
