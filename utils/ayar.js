// .env dosyasındaki ayarları okur ve eksik olanları anlaşılır şekilde bildirir.
require('dotenv').config();

const ZORUNLU = ['DISCORD_TOKEN', 'CLIENT_ID', 'OWNER_ID'];

// Eksik ayar varsa Türkçe uyarı verip programı durdurur.
function ayarlariDogrula(ekstra = []) {
  const eksik = [...ZORUNLU, ...ekstra].filter((anahtar) => !process.env[anahtar] || !process.env[anahtar].trim());
  if (eksik.length > 0) {
    console.error('❌ .env dosyasında şu ayarlar eksik veya boş: ' + eksik.join(', '));
    console.error('   Çözüm: .env.example dosyasını kopyalayıp adını ".env" yap ve boşlukları doldur. (README adım 4)');
    process.exit(1);
  }
}

module.exports = {
  ayarlariDogrula,
  token: () => (process.env.DISCORD_TOKEN || '').trim(),
  clientId: () => (process.env.CLIENT_ID || '').trim(),
  ownerId: () => (process.env.OWNER_ID || '').trim(),
  guildIdler: () => (process.env.GUILD_ID || '').split(',').map((s) => s.trim()).filter(Boolean),
};
