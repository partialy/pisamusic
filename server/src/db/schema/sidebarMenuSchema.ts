export const SIDEBAR_MENU_SQL = `
CREATE TABLE IF NOT EXISTS sidebar_menu_config (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    config_json TEXT    NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sidebar_menu_icon_uploads (
    object_key  TEXT    PRIMARY KEY,
    input_json  TEXT    NOT NULL,
    expires_at  INTEGER NOT NULL,
    file_id     TEXT
);
`;
