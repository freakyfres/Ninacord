/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2024 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { DraftStore, DraftType, React, useStateFromStores } from "@webpack/common";

import managedStyle from "./style.css?managed";

const settings = definePluginSettings({
    showRealTime: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show WPM in real-time as you type"
    },
    resetAfterInactivity: {
        type: OptionType.NUMBER,
        default: 5000,
        description: "Reset WPM after this many milliseconds of inactivity (0 to disable)"
    }
});

const WPMDisplay = ({ channelId }: { channelId: string; }) => {
    const draft = useStateFromStores([DraftStore], () => DraftStore.getDraft(channelId, DraftType.ChannelMessage));

    // We store the session data in a ref to avoid re-rendering while typing
    // except when we want to update the displayed WPM.
    const sessionRef = React.useRef({
        startTime: null as number | null,
        startLength: 0,
        lastDraft: "",
        lastActivity: Date.now(),
        channelId: channelId,
        wpm: 0
    });

    const [displayWpm, setDisplayWpm] = React.useState(0);

    React.useEffect(() => {
        const now = Date.now();
        const session = sessionRef.current;
        const inactivityTimeout = settings.store.resetAfterInactivity;

        // Reset if channel changed or draft cleared
        if (session.channelId !== channelId || !draft) {
            session.startTime = null;
            session.startLength = 0;
            session.wpm = 0;
            session.lastDraft = draft || "";
            session.channelId = channelId;
            session.lastActivity = now;
            setDisplayWpm(0);
            return;
        }

        // Inactivity reset
        if (inactivityTimeout > 0 && now - session.lastActivity > inactivityTimeout) {
            session.startTime = null;
            session.startLength = draft.length;
            session.wpm = 0;
        }

        session.lastActivity = now;

        // Start a new session if typing just started
        if (session.startTime === null && draft.length !== session.lastDraft.length) {
            session.startTime = now;
            session.startLength = session.lastDraft.length;
        }

        // Calculate WPM if session is active and draft changed
        if (session.startTime !== null && draft.length !== session.lastDraft.length) {
            const minutes = (now - session.startTime) / 60000;
            if (minutes > 0.01) { // Min 0.6 seconds to avoid spikes
                const netTyped = Math.abs(draft.length - session.startLength);
                const newWpm = Math.round((netTyped / 5) / minutes);
                if (newWpm !== session.wpm) {
                    session.wpm = newWpm;
                    setDisplayWpm(newWpm);
                }
            }
        }

        session.lastDraft = draft;
    }, [draft, channelId]);

    if (!settings.store.showRealTime || !draft || draft.length === 0 || displayWpm === 0) {
        return null;
    }

    return (
        <div className="vc-wpm-counter">
            {displayWpm} WPM
        </div>
    );
};

export default definePlugin({
    name: "WPMCounter",
    description: "Displays your current typing speed (Words Per Minute) in the chat bar.",
    authors: [Devs.Plugman],
    settings,
    managedStyle,

    chatBarButton: {
        render: ({ channel }) => <WPMDisplay channelId={channel.id} />,
        icon: () => null
    }
});
