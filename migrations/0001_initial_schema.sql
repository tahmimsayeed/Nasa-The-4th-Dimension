-- Robo Pet Station - initial schema
-- A "class" groups students by a simple class code (e.g. MOON-42).
-- No personal data is stored: nicknames only.

CREATE TABLE IF NOT EXISTS classes (
  code TEXT PRIMARY KEY,                 -- e.g. "MOON-42" (stored uppercase)
  require_approval INTEGER NOT NULL DEFAULT 0,  -- 1 = teacher must approve before exhibit goes live
  teacher_pin TEXT,                      -- optional 4-digit pin for teacher view
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exhibits (
  id TEXT PRIMARY KEY,                   -- short random id, used in URL + QR code
  class_code TEXT NOT NULL,
  nickname TEXT NOT NULL,                -- kid's chosen nickname (not a real name)
  pet_name TEXT NOT NULL,
  hardware_id TEXT NOT NULL,             -- matches an id in missions.json
  pet_config TEXT NOT NULL,              -- JSON: body, mover, color, antenna, tool, eyes
  task_type TEXT NOT NULL,               -- 'postcard' | 'decision'
  -- Mission A (postcard)
  postcard_text TEXT,
  drawing_data TEXT,                     -- PNG data URL of the kid's canvas drawing
  audio_data TEXT,                       -- webm/mp4 data URL of a <=20s voice clip
  -- Mission B (rescue or retire)
  decision TEXT,                         -- 'museum' | 'historic' | 'newjob'
  reasons TEXT,                          -- JSON array of strings
  risk TEXT,
  -- moderation
  status TEXT NOT NULL DEFAULT 'live',   -- 'live' | 'pending' | 'hidden'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (class_code) REFERENCES classes(code)
);

-- Preset sticker reactions only. No free text comments anywhere.
CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exhibit_id TEXT NOT NULL,
  sticker TEXT NOT NULL,                 -- 'star' | 'rocket' | 'heart'
  voter_key TEXT NOT NULL,               -- anonymous per-device key, stops one kid spamming
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (exhibit_id, sticker, voter_key),
  FOREIGN KEY (exhibit_id) REFERENCES exhibits(id)
);

CREATE INDEX IF NOT EXISTS idx_exhibits_class ON exhibits(class_code);
CREATE INDEX IF NOT EXISTS idx_exhibits_class_status ON exhibits(class_code, status);
CREATE INDEX IF NOT EXISTS idx_exhibits_hardware ON exhibits(hardware_id);
CREATE INDEX IF NOT EXISTS idx_exhibits_created ON exhibits(created_at);
CREATE INDEX IF NOT EXISTS idx_reactions_exhibit ON reactions(exhibit_id);
