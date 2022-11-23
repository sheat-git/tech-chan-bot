import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChannelType,
    EmbedBuilder as NormalEmbedBuilder,
    Message,
    MessageActionRowComponentBuilder,
    RepliableInteraction,
    Snowflake
} from 'discord.js';
import { notNull, sleep } from '../functions';
import EmbedBuilder from '../components/embed';

const interactions: {[messageId: Snowflake]: RepliableInteraction} = {};

const matchMessageLinks = (text: string): {guildId: string, channelId: string, messageId: string}[] => {
    const links = text.match(/https:\/\/discord(app)?.com\/channels\/\d+\/\d+\/\d+/g);
    if (!links) { return []; }
    return links.map(link => {
        const ids = link.match(/\d+/g);
        return {
            guildId: ids![0],
            channelId: ids![1],
            messageId: ids![2]
        }
    });
};

export const handleMessageLink = async (message: Message) => {
    const client = message.client;
    const links = matchMessageLinks(message.content);
    const messages: (Message|null)[] = await Promise.all(links.map(async link => {
        try {
            const guild = client.guilds.cache.get(link.guildId) ?? await client.guilds.fetch(link.guildId);
            const channel = guild.channels.cache.get(link.channelId) ?? await guild.channels.fetch(link.channelId);
            if (!channel?.isTextBased()) { throw new Error('Invalid channel'); }
            const member = guild.members.cache.get(message.author.id) ?? await guild.members.fetch(message.author.id);
            if (!member.permissionsIn(channel.id).has('ViewChannel')) { throw new Error('Channel that user can\'t view'); }
            return channel.messages.cache.get(link.messageId) ?? await channel.messages.fetch(link.messageId);
        } catch {
            return null;
        }
    }));
    const embeds = await Promise.all(messages.filter(notNull).slice(0, 10).map(async message => {
        if (message.embeds.length && !message.content.length) {
            return message.embeds[0];
        }
        const embed = new EmbedBuilder()
            .setDescription(`[メッセージへ](${message.url})`)
            .setTimestamp(message.createdTimestamp)
            .setAuthor({
                name: message.author.username,
                iconURL: message.author.displayAvatarURL()
            });
        try {
            const member = message.guild?.members.cache.get(message.author.id) ?? await message.guild?.members.fetch(message.author.id);
            if (member) {
                embed.setAuthor({
                    name: member.displayName,
                    iconURL: member.displayAvatarURL()
                });
            }
        } catch {}
        if (message.content.length) {
            embed.addFields([{name: 'Content', value: message.content.slice(0, 1024)}]);
        }
        if (message.attachments.size) {
            const image = message.attachments.find(attachment => attachment.contentType?.startsWith('image'));
            if (image) {
                embed.setImage(image.url);
            }
            if (message.attachments.size > 1) {
                embed.addFields([{
                    name: 'Attachments',
                    value: message.attachments.map(attachment => 
                        attachment.name
                        ? `[${attachment.name}](${attachment.url})`
                        : attachment.url
                    ).join('\n').slice(0, 1024)
                }]);
            }
        }
        if (message.reactions.cache.size) {
            embed.addFields([{
                name: 'Reactions',
                value: message.reactions.cache.map(reaction => reaction.emoji.toString()+` \`${reaction.count}\``).join('  ').slice(0, 1024)
            }]);
        }
        if (!message.channel.isDMBased()) {
            embed.setFooter({
                text: '#'+message.channel.name,
                iconURL: message.channel.guild.iconURL() ?? undefined
            });
        }
        return embed;
    }));
    if (embeds.length) {
        await message.reply({
            embeds: embeds,
            components: [
                new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('confirmDeleteMessageLinkDetails_'+message.author.id)
                            .setLabel('Delete')
                            .setEmoji('🗑️')
                            .setStyle(ButtonStyle.Danger)
                    )
            ]
        });
    }
};

export const handleConfirmDeleteMessageLinkDetails = async (interaction: ButtonInteraction) => {
    const embed = new NormalEmbedBuilder()
        .setColor('Red');
    if (interaction.user.id !== interaction.customId.split('_')[1]) {
        await interaction.reply({
            embeds: [
                embed
                    .setTitle('エラー')
                    .setDescription('メッセージの送信者しか削除できません。')
            ],
            ephemeral: true
        })
        return;
    }
    const messageId = (await interaction.reply({
        embeds: [
            embed
                .setTitle('本当に削除しますか？')
                .setDescription('再度表示することはできません。')
        ],
        components: [
            new ActionRowBuilder<MessageActionRowComponentBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`deleteMessageLinkDetails`)
                        .setLabel('OK')
                        .setStyle(ButtonStyle.Danger)
                )
        ],
        ephemeral: true,
        fetchReply: true
    })).id;
    interactions[messageId] = interaction;
    await sleep(15*60*1000);
    delete interactions[messageId];
};

export const handleDeleteMessageLinkDetails = async (interaction: ButtonInteraction) => {
    try {
        const ref = interaction.message.reference
        if (!ref || !ref.messageId) {
            throw new Error('Invalid Message Reference');
        }
        const client = interaction.client;
        const channel = interaction.channel ?? client.channels.cache.get(ref.channelId) ?? await client.channels.fetch(ref.channelId);
        if (!channel || !channel.isTextBased()) {
            throw new Error('Invalid Channel');
        }
        const message = channel.messages.cache.get(ref.messageId) ?? await channel.messages.fetch(ref.messageId);
        try {
            await message.delete();
        } catch {
            await interaction.reply({
                embeds: [
                    new NormalEmbedBuilder()
                        .setColor('Red')
                        .setTitle('エラー')
                        .setDescription('メッセージの削除に失敗しました。削除する権限がない可能性があります。')
                ]
            });
            return;
        }
    } catch {
        await interaction.reply({
            embeds: [
                new NormalEmbedBuilder()
                    .setColor('Red')
                    .setTitle('エラー')
                    .setDescription('メッセージが取得できませんでした。既に削除されている可能性があります。')
            ],
            ephemeral: true
        });
        return;
    }
    await Promise.all([
        interaction.reply({
            content: 'メッセージを削除しました。',
            ephemeral: true
        }),
        (async () => {
            const confirmInteraction = interactions[interaction.message.id];
            if (confirmInteraction) {
                delete interactions[interaction.message.id];
                await confirmInteraction.editReply({
                    embeds: interaction.message.embeds,
                    components: [
                        new ActionRowBuilder<MessageActionRowComponentBuilder>()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`doNothing`)
                                    .setLabel('OK')
                                    .setStyle(ButtonStyle.Danger)
                                    .setDisabled(true)
                            )
                    ]
                })
            }
        })()
    ]);
};
