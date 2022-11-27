import {
    ApplicationCommandDataResolvable,
    ChatInputCommandInteraction,
    EmbedBuilder as NormalEmbedBuilder,
    GuildMember,
    MessageReaction,
    PartialMessageReaction,
    SlashCommandBuilder,
    Snowflake
} from "discord.js";
import EmbedBuilder from "../components/embed";

type Roles = {[id: Snowflake]: string};

const guilds: {[id: Snowflake]: Roles} = {};

export const buildAttendCommand = (guildId: Snowflake, roles: Roles): ApplicationCommandDataResolvable => {
    guilds[guildId] = roles;
    return new SlashCommandBuilder()
        .setName('attend')
        .setNameLocalization('ja', 'しゅっけつ')
        .setDescription('Confirm attendance by reactions')
        .setDescriptionLocalization('ja', 'リアクションで出欠確認')
        .addStringOption( option =>
            option
                .setName('title')
                .setNameLocalization('ja', 'タイトル')
                .setDescription('Event name to confirm attendance')
                .setDescriptionLocalization('ja', '出欠確認したいイベント名')
                .setRequired(true)
        );
};

type AttendMembers = {[role: string]: {[grade: string]: string[]}};

const buildAttendEmbed = (
    title: string,
    o: AttendMembers,
    x: AttendMembers,
    q: AttendMembers,
    guildId: Snowflake
): EmbedBuilder => {
    const roles = Object.values(guilds[guildId]);
    roles.push('Unknown');
    const generateList = (m: AttendMembers): string => {
        if (!Object.keys(m).length) { return '```なし```' }
        let text = '';
        for (const role of roles) {
            const grades = m[role];
            if (!grades || !Object.keys(grades).length) { continue; }
            text += role + '\n';
            for (const grade of Object.keys(grades).sort()) {
                const members = grades[grade];
                if (!members || !members.length) { continue; }
                let isFirstLoop = true;
                for (const member of members.sort()) {
                    if (isFirstLoop) {
                        text += grade + ' '.repeat(4-Math.min(4,grade.length));
                        isFirstLoop = false;
                    } else {
                        text += '    ';
                    }
                    text += member + '\n';
                }
            }
            text += '\n';
        }
        return '```\n' + text.slice(0,-1) + '```';
    };
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription('出欠確認')
        .addFields([
            {name: '出席 ⭕', value: generateList(o)},
            {name: '欠席 ❌', value: generateList(x)},
            {name: '不明 ❓', value: generateList(q)}
        ])
};

export const handleAttendCommand = async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guildId) { 
        interaction.reply({
            embeds: [
                new NormalEmbedBuilder()
                    .setColor('Red')
                    .setTitle('エラー')
                    .setDescription('サーバー以外では使用できません。')
            ]
        });
        return;
    }
    const message = await interaction.reply({
        embeds: [
            buildAttendEmbed(
                interaction.options.getString('title', true),
                {},
                {},
                {},
                interaction.guildId
            )!
        ],
        fetchReply: true
    });
    message.react('⭕').catch();
    message.react('❌').catch();
    message.react('❓').catch();
};

export const handleAttendReaction = async (
    reaction: MessageReaction | PartialMessageReaction
) => {
    const client = reaction.client;
    const isAttendReaction = (reaction: MessageReaction | PartialMessageReaction): boolean => {
        switch (reaction.emoji.toString()) {
            case '⭕':
            case '❌':
            case '❓':
                return true;
            default:
                return false;
        }
    }
    if (!isAttendReaction(reaction)) { return; }
    const message = await (async () => {
        if (!reaction.message.partial) { return reaction.message; }
        const channel = await client.channels.fetch(reaction.message.channelId);
        if (!channel || !channel.isTextBased()) { throw new Error('Invalid channel'); }
        return await channel.messages.fetch(reaction.message.id);
    })();
    if (!client.user) { return; }
    const botId = client.user.id;
    if (message.author.id !== botId) { return; }
    if (!message.embeds.length || message.embeds[0].description !== '出欠確認') { return; }
    if (!message.guild) { return; }
    const guild = message.guild;
    if (!guilds[guild.id]) { return; }
    const allMembers: {[name: string]: GuildMember[]} = {};
    await Promise.all(message.reactions.cache.filter(isAttendReaction).map(async reaction => {
        const users = await (async () => {
            const users = reaction.users.cache;
            if (users.size === reaction.count) { return users; }
            return await reaction.users.fetch();
        })();
        users.delete(botId);
        const members: GuildMember[] = await Promise.all(users.map(async user => {
            return await guild.members.fetch(user.id);
        }));
        allMembers[reaction.emoji.toString()] = members;
    }));
    const grades: {[id: Snowflake]: string} = {};
    guild.roles.cache.forEach(role => {
        if (Number.isNaN(parseInt(role.name))) { return; }
        grades[role.id] = role.name;
    });
    const gradeIds = Object.keys(grades);
    const roles = guilds[guild.id];
    const roleIds = Object.keys(roles);
    const convertMembers = (emoji: string): AttendMembers => {
        const members = allMembers[emoji];
        if (!members) { return {}; }
        const newMembers: AttendMembers = {};
        for (const member of members) {
            const role = (() => {
                for (const roleId of roleIds) {
                    if (member.roles.cache.get(roleId)) { return roles[roleId]; }
                }
                return 'Unknown';
            })();
            const grade = (() => {
                for (const gradeId of gradeIds) {
                    if (member.roles.cache.get(gradeId)) { return grades[gradeId] }
                }
                return '??';
            })();
            if (!newMembers[role]) {
                newMembers[role] = {};
            }
            if (!newMembers[role][grade]) {
                newMembers[role][grade] = [member.displayName];
            } else {
                newMembers[role][grade].push(member.displayName);
            }
        }
        return newMembers;
    }
    message.edit({
        embeds: [
            buildAttendEmbed(
                message.embeds[0].title!,
                convertMembers('⭕'),
                convertMembers('❌'),
                convertMembers('❓'),
                guild.id
            )
        ]
    })
};
