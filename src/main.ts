import dotenv from 'dotenv';
import {
    Client,
    GatewayIntentBits,
    Message,
    MessageReaction,
    PartialMessageReaction,
    User,
    PartialUser,
    Interaction,
    Partials,
    InteractionType,
    ButtonInteraction,
    ApplicationCommandType,
    ComponentType
} from 'discord.js';
import {
    buildAttendCommand,
    handleAttendCommand,
    handleAttendReaction
} from './commands/attend';
import {
    handleConfirmDeleteMessageLinkDetails,
    handleDeleteMessageLinkDetails,
    handleMessageLink
} from './others/transfer';
import {
    buildAnonymousCommand,
    handleAnonymousCommand,
    handleConfirmSendAnonymousMessage,
    handleSendAnonymousMessage
} from './commands/anonymous';

dotenv.config();

const client = new Client({
    partials: [
        Partials.Message,
        Partials.Reaction,
        Partials.User
    ],
    intents: [
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', async () => {
    client.application?.commands.set([
        buildAnonymousCommand()
    ]);
    const PLANNING_GUILD_ID = '533221545393258496';
    client.application?.commands.set([
        buildAttendCommand(
            PLANNING_GUILD_ID,
            {
                '654258617188483073': 'コンサート',
                '654259540732280877': 'コンテスト',
                '654258761208430612': '野外ステージ'
            }
        )
    ], PLANNING_GUILD_ID);
    console.log('bot ready!');
});

client.on('messageCreate', async (message: Message) => {
    if (message.author.bot) { return; }
    try {
        await handleMessageLink(message);
    } catch (error) {
        console.error(error);
    }
});

const handleReactionChange = async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    if (reaction.message.interaction) {
        switch (reaction.message.interaction.type) {
        case InteractionType.ApplicationCommand:
            switch (reaction.message.interaction.commandName) {
            case 'attend':
                await handleAttendReaction(reaction);
                break;
            }
        }
    } else if (reaction.message.partial) {
        await handleAttendReaction(reaction);
    }
};

client.on('messageReactionAdd', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    if (user.bot) { return; }
    try {
        await handleReactionChange(reaction, user);
    } catch (error) {
        console.error(error);
    }
});

client.on('messageReactionRemove', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    if (user.bot) { return; }
    try {
        await handleReactionChange(reaction, user);
    } catch (error) {
        console.error(error);
    }
});

const buttonInteractionHandlers: {[name: string]: (interaction: ButtonInteraction) => Promise<void>} = {
    'confirmDeleteMessageLinkDetails': handleConfirmDeleteMessageLinkDetails,
    'deleteMessageLinkDetails': handleDeleteMessageLinkDetails
};

client.on('interactionCreate', async (interaction: Interaction) => {
    if (interaction.user.bot) { return; }
    try {
        switch (interaction.type) {
        case InteractionType.ApplicationCommand:
            switch (interaction.commandType) {
            case ApplicationCommandType.ChatInput:
                switch (interaction.commandName) {
                case 'attend':
                    await handleAttendCommand(interaction);
                    break;
                case 'anonymous':
                    await handleAnonymousCommand(interaction);
                    break;
                }
                break;
            }
            break;
        case InteractionType.MessageComponent:
            switch (interaction.componentType) {
            case ComponentType.Button:
                if (interaction.customId.startsWith('confirmDeleteMessageLinkDetails')) {
                    await handleConfirmDeleteMessageLinkDetails(interaction);
                    break;
                }
                switch (interaction.customId) {
                case 'deleteMessageLinkDetails':
                    await handleDeleteMessageLinkDetails(interaction);
                    break;
                case 'sendAnonymousMessage':
                    await handleSendAnonymousMessage(interaction);
                    break;
                }
                break;
            }
            break;
        case InteractionType.ModalSubmit:
            switch (interaction.customId) {
            case 'confirmSendAnonymousMessage':
                await handleConfirmSendAnonymousMessage(interaction);
                break;
            }
            break;
        }
    } catch (error) {
        console.error(error);
    }
});

process.on('uncaughtException', (error) => {
    console.error(error);
});

client.login(process.env.BOT_TOKEN);
