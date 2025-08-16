export const NotificationPlugin = async ({ client, $ }) => {
	return {
		event: async ({ event }) => {
			if (event.type === "session.idle") {
				await $`notify-send -t 1000 "Opencode" "Done"`;
			}
		},
	};
};
