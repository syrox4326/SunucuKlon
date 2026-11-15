// Sunucuyu ID ile bulur. Bot sunucuda değilse anlaşılır Türkçe hata verir.
const { snowflakeMi } = require('./yardimci');

async function sunucuGetir(client, id, rol = 'Sunucu') {
  const temiz = String(id || '').trim();
  if (!snowflakeMi(temiz)) throw new Error(`${rol} ID'si geçersiz. ID, 17-20 haneli bir sayı olmalı. (Sunucuya sağ tıkla > Sunucu ID'sini Kopyala)`);
  try {
    return await client.guilds.fetch(temiz);
  } catch {
    throw new Error(`${rol} (${temiz}) bulunamadı. Bot bu sunucuda olmayabilir. Önce botu o sunucuya Yönetici izniyle ekle. (README adım 3)`);
  }
}

module.exports = { sunucuGetir };
