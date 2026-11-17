// /herkesi kayıtsıza at : sunucudaki herkesin rollerini alıp sadece kayıtsız rolünü bırakır. (sadece Yönetici izni olanlar)
// Çok yıkıcı bir işlem olduğu için önce özet + onay ister, çalışırken durdurulabilir ve her üyenin rolleri kayda alınır.
const {
  SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags,
} = require('discord.js');
const { RENK, taslak, alan, hata } = require('../utils/tasarim');
const { ayarGetir, rolPlani } = require('../utils/kayit');
const { db, yetkiliRoller } = require('../utils/veritabani');

const calisanlar = new Set(); // aynı anda tek toplu işlem
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const EN_UZUN_SURE = 14 * 60 * 1000; // etkileşim yanıtı 15 dk geçerli, güvenli taraf

const dugme = (id, yazi, stil, kapali = false) => new ButtonBuilder().setCustomId(id).setLabel(yazi).setStyle(stil).setDisabled(kapali);
const satir = (...d) => new ActionRowBuilder().addComponents(...d);

module.exports = {
  yetki: { yonetici: true },
  data: new SlashCommandBuilder()
    .setName('herkesi')
    .setDescription('Toplu işlemler.')
    .addSubcommandGroup((g) =>
      g
        .setName('kayıtsıza')
        .setDescription('Üyeleri kayıtsıza atar.')
        .addSubcommand((s) =>
          s
            .setName('at')
            .setDescription('Sunucudaki herkesin rollerini alıp sadece kayıtsız rolünü bırakır.')
            .addBooleanOption((o) =>
              o.setName('yetkilileri_koru').setDescription('Yetkili rollerdekilere ve Yönetici iznine sahip olanlara dokunma (varsayılan: evet)'),
            ),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction, client) {
    const gizli = { flags: MessageFlags.Ephemeral };
    const ayar = ayarGetir(interaction.guildId);
    if (!ayar) return interaction.reply({ embeds: [hata('Kayıt sistemi kurulmamış. Önce `/kayıtkur` komutunu çalıştır.')], ...gizli });
    if (calisanlar.has(interaction.guildId)) return interaction.reply({ embeds: [hata('Bu sunucuda zaten devam eden bir toplu işlem var.')], ...gizli });
    const kayitsizRol = interaction.guild.roles.cache.get(ayar.kayitsiz_rol_id);
    if (!kayitsizRol) return interaction.reply({ embeds: [hata('Ayarlardaki kayıtsız rolü silinmiş. `/kayıtkur` ile sistemi yeniden kur.')], ...gizli });

    const koru = interaction.options.getBoolean('yetkilileri_koru') ?? true;
    await interaction.deferReply(gizli);

    // ---- Plan ----
    const benimEnYuksek = interaction.guild.members.me.roles.highest.position;
    const yetkiliRolIdleri = new Set(yetkiliRoller(interaction.guildId).map((r) => r.rol_id));
    const uyeler = await interaction.guild.members.fetch();
    const hedefler = [];
    const sayac = { bot: 0, sahip: 0, kendin: 0, korunan: 0, yonetemiyorum: 0, zatenKayitsiz: 0 };
    for (const u of uyeler.values()) {
      if (u.user.bot) sayac.bot++;
      else if (u.id === interaction.guild.ownerId) sayac.sahip++;
      else if (u.id === interaction.user.id) sayac.kendin++;
      else if (koru && (u.permissions.has(PermissionFlagsBits.Administrator) || u.roles.cache.some((r) => yetkiliRolIdleri.has(r.id)))) sayac.korunan++;
      else if (!u.manageable) sayac.yonetemiyorum++;
      else if (u.roles.cache.has(kayitsizRol.id) && rolPlani(u, kayitsizRol, benimEnYuksek).alinacak.length === 0) sayac.zatenKayitsiz++;
      else hedefler.push(u);
    }
    if (hedefler.length === 0) {
      return interaction.editReply({ embeds: [hata('Kayıtsıza atılacak üye bulunamadı. Herkes ya zaten kayıtsız ya da korunuyor.')] });
    }

    const onizleme = taslak(client, RENK.kick, 'Toplu kayıtsıza atma: onay gerekli').setDescription(
      [
        `**${hedefler.length}** üyenin tüm rolleri alınacak ve sadece ${kayitsizRol} rolü kalacak. Takma adları da sıfırlanacak.`,
        '',
        `> • **İşlenecek üye:** ${hedefler.length}`,
        `> • **Yetkili/Yönetici (korunan):** ${koru ? sayac.korunan : 'Koruma kapalı'}`,
        `> • **Zaten kayıtsız:** ${sayac.zatenKayitsiz}`,
        `> • **Botlar, sunucu sahibi, sen:** ${sayac.bot + sayac.sahip + sayac.kendin}`,
        `> • **Botun yönetemediği üyeler:** ${sayac.yonetemiyorum}`,
        '',
        'Bot/entegrasyon rolleri (Booster vb.) ve aktif mute rolü alınmaz. Alınan roller kayıt altına alınır ama **bu işlem toplu olarak geri alınamaz.**',
      ].join('\n'),
    );
    const mesaj = await interaction.editReply({
      embeds: [onizleme],
      components: [satir(dugme('onay', `${hedefler.length} üyeyi kayıtsıza at`, ButtonStyle.Danger), dugme('iptal', 'Vazgeç', ButtonStyle.Secondary))],
    });

    let tiklama;
    try {
      tiklama = await mesaj.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 60_000,
      });
    } catch {
      return interaction.editReply({ embeds: [taslak(client, RENK.bilgi, 'Süre doldu').setDescription('Onay verilmedi, hiçbir değişiklik yapılmadı.')], components: [] });
    }
    if (tiklama.customId !== 'onay') {
      return tiklama.update({ embeds: [taslak(client, RENK.bilgi, 'Vazgeçildi').setDescription('Hiçbir değişiklik yapılmadı.')], components: [] });
    }

    // ---- Uygulama ----
    calisanlar.add(interaction.guildId);
    let durdur = false;
    const basla = Date.now();
    const sonuc = { tamam: 0, hata: 0 };
    const ilerleme = (bitti) =>
      taslak(client, RENK.kick, bitti ? 'Toplu kayıtsıza atma bitti' : 'Toplu kayıtsıza atma sürüyor').setDescription(
        [
          `> • **İşlenen:** ${sonuc.tamam + sonuc.hata} / ${hedefler.length}`,
          `> • **Başarılı:** ${sonuc.tamam}`,
          `> • **Hata:** ${sonuc.hata}`,
          bitti && durdur ? '\nİşlem durduruldu veya süre sınırına ulaşıldı, kalan üyelere dokunulmadı.' : '',
        ].join('\n'),
      );
    await tiklama.update({ embeds: [ilerleme(false)], components: [satir(dugme('durdur', 'Durdur', ButtonStyle.Danger))] });
    const toplayici = mesaj.createMessageComponentCollector({ componentType: ComponentType.Button, filter: (i) => i.user.id === interaction.user.id });
    toplayici.on('collect', async (i) => {
      if (i.customId === 'durdur') {
        durdur = true;
        await i.update({ components: [satir(dugme('durdur', 'Durduruluyor...', ButtonStyle.Secondary, true))] }).catch(() => {});
      }
    });

    const kayitla = db.prepare('INSERT INTO kayitsiz_log (guild_id, user_id, yetkili_id, sebep, roller, isim, zaman) VALUES (?, ?, ?, ?, ?, ?, ?)');
    try {
      for (const u of hedefler) {
        if (durdur || Date.now() - basla > EN_UZUN_SURE) {
          durdur = true;
          break;
        }
        try {
          const { korunan, alinamayan, alinacak } = rolPlani(u, kayitsizRol, benimEnYuksek);
          // Tek istekle: kalacak roller + kayıtsız, takma ad sıfır
          await u.edit({ roles: [...korunan, ...alinamayan, kayitsizRol], nick: null, reason: `Toplu kayıtsıza atma: ${interaction.user.tag}` });
          kayitla.run(interaction.guildId, u.id, interaction.user.id, 'Toplu kayıtsıza atma', JSON.stringify(alinacak.map((r) => r.id)), u.nickname ?? null, Date.now());
          sonuc.tamam++;
        } catch (e) {
          sonuc.hata++;
          console.error(`[herkesi kayıtsıza at] ${u.id}: ${e.message}`);
        }
        if ((sonuc.tamam + sonuc.hata) % 5 === 0) await interaction.editReply({ embeds: [ilerleme(false)] }).catch(() => {});
        await bekle(500);
      }
    } finally {
      calisanlar.delete(interaction.guildId);
      toplayici.stop();
    }
    return interaction.editReply({ embeds: [ilerleme(true)], components: [] }).catch(() => {});
  },
};
