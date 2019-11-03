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

const Gtk = imports.gi.Gtk;
const DBusUtils = imports.dbusUtils;
const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

var AskRenamePopup = class {

    constructor(fileItem) {

        this._fileItem = fileItem;
        this._window = new Gtk.Popover({relative_to: fileItem.actor});
        let contentBox = new Gtk.Grid();
        this._window.add(contentBox);
        let label = new Gtk.Label({label: _("File name"),
                                   justify: Gtk.Justification.LEFT,
                                   halign: Gtk.Align.START});
        contentBox.attach(label, 0, 0, 2, 1);
        this._textArea = new Gtk.Entry();
        this._textArea.text = fileItem.fileName;
        contentBox.attach(this._textArea, 0, 1, 1, 1);
        let button = new Gtk.Button({label: _("Rename")});
        contentBox.attach(button, 1, 1, 1, 1);
        button.connect('clicked', () => {
            this._do_rename();
        });
        this._textArea.connect('activate', () => {
            this._do_rename();
        });
        this._window.show_all();
    }

    _do_rename() {
        DBusUtils.NautilusFileOperationsProxy.RenameFileRemote(this._fileItem.file.get_uri(),
                                                               this._textArea.text,
            (result, error) => {
                if (error)
                    throw new Error('Error renaming file: ' + error.message);
            }
        );
    }
};
