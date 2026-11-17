// Butonlu rol sistemi: mesajdaki butona basan kişi rolü alır, tekrar basarsa rol geri alınır.
// Butonun kimliği rolün ID'sini taşıdığı için bot yeniden başlasa da eski butonlar çalışmaya devam eder.
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { RENK, hata } = require('./tasarim');

const ONEK = 'butonrol:';
const BEKLEME_MS = 3000;
const sonTik = new Map();

const gizli = { flags: MessageFlags.Ephemeral };

async function tikla(interaction) {
  const rolId = interaction.customId.slice(ONEK.length);
  const uye = interaction.member;
  if (!interaction.guild || !uye) return;

  const simdi = Date.now();
  if (simdi - (sonTik.get(interaction.user.id) ?? 0) < BEKLEME_MS) {
    return interaction.reply({ embeds: [hata('Çok hızlı tıklıyorsun, birkaç saniye bekle.')], ...gizli });
  }
  sonTik.set(interaction.user.id, simdi);

  const rol = interaction.guild.roles.cache.get(rolId) ?? (await interaction.guild.roles.fetch(rolId).catch(() => null));
  if (!rol) return interaction.reply({ embeds: [hata('Bu butona bağlı rol artık yok. Bir yetkiliye haber ver.')], ...gizli });

  try {
    const varMi = uye.roles.cache.has(rol.id);
    if (varMi) await uye.roles.remove(rol, 'Buton rol: kullanıcı geri aldı');
    else await uye.roles.add(rol, 'Buton rol: kullanıcı aldı');
    const e = new EmbedBuilder()
      .setColor(varMi ? RENK.bilgi : RENK.unmute)
      .setDescription(varMi ? `**${rol.name}** rolü senden alındı.` : `**${rol.name}** rolünü aldın.`);
    return interaction.reply({ embeds: [e], ...gizli });
  } catch (e) {
    console.error('[butonrol]', e.message);
    return interaction.reply({ embeds: [hata('Rol verilemedi. Botun rolü, bu rolün üstünde olmalı. Bir yetkiliye haber ver.')], ...gizli });
  }
}

module.exports = { ONEK, tikla };
