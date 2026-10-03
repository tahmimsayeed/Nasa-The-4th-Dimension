-- Robo Pet Station - demo data
-- Gives a teacher a Class Museum Wall that already has exhibits to look at,
-- so the gallery is never empty on the first day.

INSERT OR REPLACE INTO classes (code, require_approval, teacher_pin) VALUES
  ('MOON-42', 0, '1234'),
  ('MARS-7', 1, '1234');

INSERT OR REPLACE INTO exhibits
  (id, class_code, nickname, pet_name, hardware_id, pet_config, task_type,
   postcard_text, decision, reasons, risk, status, created_at)
VALUES
  ('demo0001', 'MOON-42', 'StarPilot7', 'Dusty', 'lunar_rover',
   '{"body":"flat","mover":"wheels4","color":"#e8b23f","antenna":"dish","tool":"camera","eyes":"happy"}',
   'postcard',
   'Hello from the Moon! I am parked in the Taurus-Littrow Valley and my tire tracks are still here because there is no wind on the Moon. My top speed was about 8 miles per hour, slower than a bike going downhill. I helped astronauts reach rocks they could never walk to. I feel proud, not lonely, because I was the first car humans ever drove on another world.',
   NULL, NULL, NULL, 'live', datetime('now','-6 days')),

  ('demo0002', 'MOON-42', 'RocketKid', 'Pebble', 'sojourner',
   '{"body":"boxy","mover":"wheels6","color":"#e05c3f","antenna":"whip","tool":"lab","eyes":"big"}',
   'decision', NULL,
   'historic',
   '["This is exactly where I made history, so I belong here.","Future astronauts could visit me like a monument.","Moving me might break me and I am very old now."]',
   'One problem could be that dust storms will slowly bury me, so visitors might not find me.',
   'live', datetime('now','-5 days')),

  ('demo0003', 'MOON-42', 'NebulaFox', 'Blue', 'opportunity',
   '{"body":"round","mover":"wheels6","color":"#3f9ce0","antenna":"double","tool":"arm","eyes":"star"}',
   'postcard',
   'Greetings from Perseverance Valley on Mars! I drove 28 miles here, which is farther than a marathon. I found little round pebbles the scientists nicknamed blueberries, and they proved water once soaked this ground. A giant dust storm covered the sky and my solar panels went dark. I am sleepy now, but I am happy. I was built for 90 days and I worked for almost 15 years.',
   NULL, NULL, NULL, 'live', datetime('now','-3 days')),

  ('demo0004', 'MOON-42', 'CometCat', 'Whirly', 'ingenuity',
   '{"body":"tall","mover":"rotors","color":"#9a62d8","antenna":"whip","tool":"camera","eyes":"visor"}',
   'decision', NULL,
   'newjob',
   '["My parts still work, so I could be a weather station on Mars.","I could measure the wind to help the next flying robots.","Reusing me saves launching something brand new."]',
   'A risk I thought about is that my solar panel might get too dusty to charge me.',
   'live', datetime('now','-2 days')),

  ('demo0005', 'MOON-42', 'GalaxyGoat', 'Echo', 'voyager1',
   '{"body":"boxy","mover":"thrusters","color":"#2fb5a8","antenna":"dish","tool":"lab","eyes":"sleepy"}',
   'postcard',
   'Hello Earth, this is Voyager 1 calling from interstellar space, the space between the stars. My radio signal takes more than 22 hours to reach you. I discovered erupting volcanoes on Jupiter moon Io, the first active volcanoes ever found away from Earth. I do not feel left behind at all. I chose to keep going, and I carry a golden record with a baby laughing on it so whoever finds me knows we were here.',
   NULL, NULL, NULL, 'live', datetime('now','-1 days')),

  ('demo0006', 'MOON-42', 'LunaBug', 'Rocky', 'spirit',
   '{"body":"boxy","mover":"tracks","color":"#b9bec9","antenna":"dish","tool":"drill","eyes":"one"}',
   'decision', NULL,
   'museum',
   '["Kids on Earth could see me in person and learn from me.","I am a piece of history, like a dinosaur bone.","I would be safe from dust storms instead of slowly rusting."]',
   'It might be hard because I am stuck in soft sand and pulling me out could snap my broken wheel.',
   'live', datetime('now','-4 hours'));

INSERT OR IGNORE INTO reactions (exhibit_id, sticker, voter_key) VALUES
  ('demo0001','star','seed-a'), ('demo0001','rocket','seed-b'), ('demo0001','heart','seed-c'),
  ('demo0001','star','seed-d'), ('demo0001','star','seed-e'),
  ('demo0002','rocket','seed-a'), ('demo0002','rocket','seed-c'), ('demo0002','heart','seed-f'),
  ('demo0003','heart','seed-a'), ('demo0003','heart','seed-b'), ('demo0003','star','seed-g'),
  ('demo0003','rocket','seed-h'), ('demo0003','heart','seed-i'),
  ('demo0004','star','seed-b'), ('demo0004','rocket','seed-j'),
  ('demo0005','heart','seed-c'), ('demo0005','star','seed-k'), ('demo0005','rocket','seed-l'),
  ('demo0005','heart','seed-m'),
  ('demo0006','star','seed-n'), ('demo0006','heart','seed-o');
