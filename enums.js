/* Desktop Icons GNOME Shell extension
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

const ICON_SIZE = { 'small': 48, 'standard': 64, 'large': 96 };
const ICON_WIDTH = { 'small': 112, 'standard': 120, 'large': 120 };
const ICON_HEIGHT = { 'small': 90, 'standard': 106, 'large': 138 };

const FileType = {
    NONE: null,
    USER_DIRECTORY_HOME: 'show-home',
    USER_DIRECTORY_TRASH: 'show-trash',
}
