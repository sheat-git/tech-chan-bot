import { EmbedBuilder as NormalEmbedBuilder } from "@discordjs/builders";
import { APIEmbed } from "discord.js";

export default class EmbedBuilder extends NormalEmbedBuilder {
    constructor(data?: APIEmbed) {
        super(data);
        this.setColor(0x66A2F8);
    }
}
