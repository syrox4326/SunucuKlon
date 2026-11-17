// Basit yerel veritabanı (SQLite, Node'un yerleşik node:sqlite modülü). Dosya: veri.db (git'e girmez)
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.join(__dirname, '..', 'veri.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS yetkili_roller (
    guild_id TEXT NOT NULL,
    rol_id   TEXT NOT NULL,
    ad       TEXT NOT NULL,
    sira     INTEGER NOT NULL,          -- sunucudaki rol konumu (büyük = daha yüksek yetki)
    PRIMARY KEY (guild_id, rol_id)
  );
`);

// Bir sunucunun yetkili rollerini tamamen yenisiyle değiştirir.
function yetkiliRolleriKaydet(guildId, roller) {
  const sil = db.prepare('DELETE FROM yetkili_roller WHERE guild_id = ?');
  const ekle = db.prepare('INSERT INTO yetkili_roller (guild_id, rol_id, ad, sira) VALUES (?, ?, ?, ?)');
  db.exec('BEGIN');
  try {
    sil.run(guildId);
    for (const r of roller) ekle.run(guildId, r.id, r.ad, r.sira);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function yetkiliRoller(guildId) {
  return db.prepare('SELECT rol_id, ad, sira FROM yetkili_roller WHERE guild_id = ? ORDER BY sira DESC').all(guildId);
}

module.exports = { db, yetkiliRolleriKaydet, yetkiliRoller };
