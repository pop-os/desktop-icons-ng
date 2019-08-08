project('adieu',
  version: '19.08.1',
  license: 'GPL3'
)

gnome = import ('gnome')
i18n = import('i18n')

prefix = get_option('prefix')
datadir = join_paths (prefix, get_option('datadir'))
schema_dir = join_paths(datadir, 'glib-2.0', 'schemas')

extensions_dir = join_paths(prefix, 'share', 'gnome-shell', 'extensions', 'adieu@rastersoft.com')

install_data([
#    'createFolderDialog.js',
    'adieu.js',
    'createThumbnail.js',
    'dbusUtils.js',
    'desktopGrid.js',
    'desktopIconsUtil.js',
    'desktopManager.js',
    'extension.js',
    'fileItem.js',
    'metadata.json',
    'prefs.js',
    'stylesheet.css'
  ],
  install_dir: extensions_dir
)

subdir(
  'po'
)
subdir(
  'schemas'
)

meson.add_install_script('meson_post_install.py')
