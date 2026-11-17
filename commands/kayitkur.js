// /kayıtkur : kayıt sistemini kurar (sadece yönetici izni olanlar).
const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { RENK, hata } = require('../utils/tasarim');
const { sahipMi } = require('../utils/yetki');
const { ayarKaydet } = require('../utils/kayit');

const METIN = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

module.exports = {
  yetki: { yonetici: true },
  data: new SlashCommandBuilder()
    .setName('kayıtkur')
    .setDescription('Üye kayıt sistemini kurar.')
    .addChannelOption((o) => o.setName('kanal').setDescription('Kayıt işleminin yapılacağı kanal (kayıt sadece burada çalışır)').setRequired(true).addChannelTypes(...METIN))
    .addRoleOption((o) => o.setName('kayıtsız').setDescription('Kayıtsız üyelerin rolü (sunucuya giren otomatik alır)').setRequired(true))
    .addChannelOption((o) => o.setName('sohbet').setDescription('Yeni kayıt olanın bildirileceği sohbet kanalı').setRequired(true).addChannelTypes(...METIN))
    .addRoleOption((o) => o.setName('rol').setDescription('Kaydedilen kişiye verilecek rol').setRequired(true))
    .addRoleOption((o) => o.setName('kayıtyetkili').setDescription('Kayıt yapabilecek yetkili rolü').setRequired(true))
    .addRoleOption((o) => o.setName('rol2').setDescription('Kaydedilene verilecek ikinci rol (isteğe bağlı)'))
    .addRoleOption((o) => o.setName('rol3').setDescription('Kaydedilene verilecek üçüncü rol (isteğe bağlı)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction, client) {
    const o = interaction.options;
    const kanal = o.getChannel('kanal');
    const kayitsiz = o.getRole('kayıtsız');
    const sohbet = o.getChannel('sohbet');
    const rol = o.getRole('rol');
    const yetkili = o.getRole('kayıtyetkili');
    const rol2 = o.getRole('rol2');
    const rol3 = o.getRole('rol3');
    const verilecek = [rol, rol2, rol3].filter(Boolean);
    const reddet = (m) => interaction.reply({ embeds: [hata(m)], flags: MessageFlags.Ephemeral });

    // Roller
    const benim = interaction.guild.members.me;
    for (const r of [kayitsiz, ...verilecek, yetkili]) {
      if (r.id === interaction.guildId) return reddet('@everyone rolü seçilemez.');
      if (r.managed) return reddet(`**${r.name}** bir bot/entegrasyon rolü, seçilemez.`);
    }
    if (new Set(verilecek.map((r) => r.id)).size !== verilecek.length) return reddet('Aynı rolü birden fazla kez seçtin.');
    if (verilecek.some((r) => r.id === kayitsiz.id)) return reddet('Kayıt rolü, kayıtsız rolüyle aynı olamaz.');
    for (const r of [kayitsiz, ...verilecek]) {
      if (r.position >= benim.roles.highest.position) {
        return reddet(`Botun rolü **${r.name}** rolünün üstünde değil, bu rolü yönetemem. Sunucu Ayarları > Roller'den bot rolünü yukarı taşı.`);
      }
      if (!sahipMi(interaction.user.id) && r.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
        return reddet(`**${r.name}** rolü, senin en yüksek rolüne eşit veya ondan yüksek. Kendi seviyenin üstünde rol dağıtan bir sistem kuramazsın.`);
      }
    }
    // Kanallar
    const kanalIzin = kanal.permissionsFor(benim);
    if (!kanalIzin?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory])) {
      return reddet(`Botun ${kanal} kanalını görme/yazma izni yok.`);
    }
    if (!sohbet.permissionsFor(benim)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
      return reddet(`Botun ${sohbet} kanalında mesaj gönderme izni yok.`);
    }

    ayarKaydet(interaction.guildId, {
      kanal: kanal.id, kayitsiz: kayitsiz.id, sohbet: sohbet.id, rol: rol.id, rol2: rol2?.id, rol3: rol3?.id, yetkili: yetkili.id,
    });

    const satirlar = [
      `• **Kayıt Kanalı:** ${kanal}`,
      `• **Kayıt Rolü:** ${verilecek.map((r) => `${r}`).join(' ')}`,
      `• **Kayıtsız Rolü:** ${kayitsiz}`,
      `• **Yetkili Rolü:** ${yetkili}`,
      `• **Sohbet Kanalı:** ${sohbet}`,
    ];
    const e = new EmbedBuilder()
      .setColor(RENK.unmute)
      .setTitle('✅ Kayıt Sistemi Başarıyla Kuruldu!')
      .setDescription(`${satirlar.map((s) => `> ${s}`).join('\n')}\n\nKayıt komutu: \`.k @kullanıcı İsim | Yaş\` (yalnızca ${kanal} kanalında çalışır)`)
      .setFooter({ text: "Kerem's Bot Kayıt Sistemi" });
    const ikon = interaction.guild.iconURL({ size: 256 });
    if (ikon) e.setThumbnail(ikon);

    // Gerekli intent'ler kapalıysa dürüstçe söyle
    const eksik = [];
    if (!client.mesajIcerigiAcik) eksik.push('**Message Content Intent** kapalı: `.k` komutu okunamaz.');
    if (!client.uyeIntentAcik) eksik.push('**Server Members Intent** kapalı: sunucuya giren üyelere kayıtsız rolü otomatik verilemez.');
    if (eksik.length) e.addFields({ name: 'Dikkat', value: eksik.join('\n') + '\nDeveloper Portal > Bot > Privileged Gateway Intents bölümünden aç ve botu yeniden başlat.', inline: false });

    return interaction.reply({ embeds: [e] });
  },
};
