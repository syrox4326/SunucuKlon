// Slash komutlarını Discord'a kaydeder (sunucuya özel). Komut ekleyince/değiştirince tekrar çalıştır:
//   npm run komutlari-kaydet
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const ayar = require('./utils/ayar');

ayar.ayarlariDogrula(['GUILD_ID']);

const komutlar = [];
const klasor = path.join(__dirname, 'commands');
for (const dosya of fs.readdirSync(klasor).filter((d) => d.endsWith('.js'))) {
  const komut = require(path.join(klasor, dosya));
  if (komut.data) komutlar.push(komut.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(ayar.token());

(async () => {
  for (const guildId of ayar.guildIdler()) {
    try {
      await rest.put(Routes.applicationGuildCommands(ayar.clientId(), guildId), { body: komutlar });
      console.log(`✅ ${komutlar.length} komut kaydedildi (sunucu: ${guildId})`);
    } catch (hata) {
      console.error(`❌ Sunucu ${guildId} için komutlar kaydedilemedi: ${hata.message}`);
      console.error('   Olası nedenler: GUILD_ID yanlış, bot o sunucuda değil veya davet ederken "applications.commands" izni verilmedi.');
      process.exitCode = 1;
    }
  }
})();
