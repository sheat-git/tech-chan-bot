import {
    ActionRowBuilder,
    ApplicationCommandDataResolvable,
    Attachment,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder as NormalEmbedBuilder,
    InteractionReplyOptions,
    MessageActionRowComponentBuilder,
    ModalBuilder,
    ModalSubmitInteraction,
    RepliableInteraction,
    SlashCommandBuilder,
    Snowflake,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import EmbedBuilder from '../components/embed';
import { sleep } from '../functions';

const interactions: {[messageId: Snowflake]: RepliableInteraction} = {};

export const buildAnonymousCommand = (): ApplicationCommandDataResolvable => {
    return new SlashCommandBuilder()
        .setName('anonymous')
        .setNameLocalization('ja', 'とくめい')
        .setDescription('Chat anonymously')
        .setDescriptionLocalization('ja', '匿名で発言')
        .addStringOption( option =>
            option
                .setName('content')
                .setNameLocalization('ja','内容')
                .setDescription('Content to chat')
                .setDescriptionLocalization('ja', '発言したい内容')
                .setRequired(false)
        )
        .addAttachmentOption( option =>
            option
                .setName('file')
                .setNameLocalization('ja', 'ファイル')
                .setDescription('Filt to send')
                .setDescriptionLocalization('ja', '送信したいファイル')
                .setRequired(false)
        )
};

const replyConfirm = async (
    interaction: RepliableInteraction,
    content: string | null,
    attachment: Attachment | null
) => {
    if (!content?.length && !attachment) {
        await interaction.reply({
            embeds: [
                new NormalEmbedBuilder()
                    .setColor('Red')
                    .setTitle('エラー')
                    .setDescription('入力が不足しています。')
            ]
        })
        return;
    }
    const options: InteractionReplyOptions = {
        content: '以下を送信します。よろしいですか？',
        ephemeral: true,
        components: [
            new ActionRowBuilder<MessageActionRowComponentBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('sendAnonymousMessage')
                        .setLabel('OK')
                        .setStyle(ButtonStyle.Danger)
                )
        ],
        fetchReply: true
    };
    const embed = new EmbedBuilder()
        .setTitle('匿名で送信')
    if (content?.length) {
        embed.setDescription(content);
    }
    if (attachment?.contentType?.startsWith('image')) {
        embed.setImage(attachment.url);
    } else if (attachment) {
        embed.addFields({
            name: 'File',
            value: attachment.name ? `[${attachment.name}](${attachment.url})` : attachment.url
        });
    }
    options.embeds = [embed];
    const messageId = (await interaction.reply(options)).id;
    interactions[messageId] = interaction;
    await sleep(15*60*1000);
    delete interactions[messageId];
};

export const handleAnonymousCommand = async (interaction: ChatInputCommandInteraction) => {
    const content = interaction.options.getString('content', false);
    const attachment = interaction.options.getAttachment('file', false);
    if (content?.length || attachment) {
        await replyConfirm(interaction, content, attachment);
        return;
    }
    await interaction.showModal(
        new ModalBuilder()
            .setCustomId('confirmSendAnonymousMessage')
            .setTitle('匿名で発言')
            .addComponents([
                new ActionRowBuilder<TextInputBuilder>()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId('content')
                            .setLabel('内容')
                            .setStyle(TextInputStyle.Paragraph)
                            .setMaxLength(1024)
                            .setRequired(true)
                    )
            ])
    );
};

export const handleConfirmSendAnonymousMessage = async (interaction: ModalSubmitInteraction) => {
    await replyConfirm(
        interaction,
        interaction.fields.getTextInputValue('content'),
        null
    );
};

export const handleSendAnonymousMessage = async (interaction: ButtonInteraction) => {
    await interaction.reply({
        embeds: interaction.message.embeds,
        files: interaction.message.attachments.first(interaction.message.attachments.size)
    });
    const confirmInteraction = interactions[interaction.message.id];
    if (confirmInteraction) {
        delete interactions[interaction.message.id];
        await confirmInteraction.editReply({
            content: '送信しました。',
            embeds: [],
            files: [],
            components: []
        });
    }
};
