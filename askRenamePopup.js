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
const Gettext = imports.gettext.domain('ding');

const _ = Gettext.gettext;

var AskRenamePopup = class {

    constructor(filename, parentWindow) {

        this._window = new Gtk.Dialog({use_header_bar: false,
                                       window_position: Gtk.WindowPosition.CENTER_ON_PARENT,
                                       transient_for: parentWindow,
                                       deletable: false,
                                       hexpand: false,
                                       vexpand: false});
        this._window.set_modal(true);
        this._window.set_title(_("File name"));
        let contentArea = this._window.get_content_area();
        this._textArea = new Gtk.Entry();
        if (filename) {
            this._textArea.text = filename;
        }
        contentArea.orientation = Gtk.Orientation.HORIZONTAL;
        contentArea.pack_start(this._textArea, true, true, 5);
        let button = new Gtk.Button({label: _("Rename")});
        contentArea.pack_start(button, false, false, 5);
        button.connect('clicked', () => {
            this._window.response(Gtk.ResponseType.OK);
        });
        this._textArea.connect('activate', () => {
            this._window.response(Gtk.ResponseType.OK);
        });
    }

    run() {
        this._window.show_all();
        let retval = this._window.run();
        this._window.hide();
        if (retval == Gtk.ResponseType.OK) {
            return this._textArea.text;
        } else {
            return null;
        }
    }
};
