// Ortak sayfalı liste tasarımı (/mutelist, /banlist, /kicklist).
// Her kayıt: kalın başlık satırı + sol çizgili (alıntı) etiket/değer satırları. Kayıtlar arasında boşluk.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const { taslak } = require('./tasarim');

const SAYFA_BOYUTU = 5;
const kisalt = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// girdiler: [{ baslik: 'rasmuss  `123`', satirlar: [['Yetkili', '<@1>'], ['Sebep', '...']] }]
function girdiMetni(sira, g) {
  const satirlar = g.satirlar.map(([etiket, deger]) => `> **${etiket}**  ${kisalt(String(deger), 220)}`).join('\n');
  return `**${sira}.**  ${g.baslik}\n${satirlar}`;
}

async function listeGonder(interaction, client, { renk, baslik, ozet, girdiler }) {
  const sayfaSayisi = Math.max(1, Math.ceil(girdiler.length / SAYFA_BOYUTU));
  const sayfaUret = (n) => {
    const govde = girdiler
      .slice(n * SAYFA_BOYUTU, (n + 1) * SAYFA_BOYUTU)
      .map((g, i) => girdiMetni(n * SAYFA_BOYUTU + i + 1, g))
      .join('\n\n');
    return taslak(client, renk, baslik)
      .setDescription(`${ozet}\n\n${govde}`.slice(0, 4000))
      .setFooter({ text: `Sayfa ${n + 1} / ${sayfaSayisi}` });
  };
  const dugmeler = (n) =>
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('onceki').setLabel('Önceki').setStyle(ButtonStyle.Secondary).setDisabled(n === 0),
      new ButtonBuilder().setCustomId('sonraki').setLabel('Sonraki').setStyle(ButtonStyle.Secondary).setDisabled(n >= sayfaSayisi - 1),
    );

  let sayfa = 0;
  const yanit = await interaction.editReply({
    embeds: [sayfaUret(sayfa)],
    components: sayfaSayisi > 1 ? [dugmeler(sayfa)] : [],
    allowedMentions: { parse: [] },
  });
  if (sayfaSayisi <= 1) return;

  const toplayici = yanit.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) => i.user.id === interaction.user.id,
    time: 5 * 60 * 1000,
  });
  toplayici.on('collect', async (i) => {
    sayfa += i.customId === 'sonraki' ? 1 : -1;
    await i.update({ embeds: [sayfaUret(sayfa)], components: [dugmeler(sayfa)] });
  });
  toplayici.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
}

const gizliBekle = (interaction) => interaction.deferReply({ flags: MessageFlags.Ephemeral });

module.exports = { listeGonder, gizliBekle };
