import type { LineMessage } from "./line";

// The message the partner receives when an invite is shared: the code in the
// text, the invite URL behind the "Setlogを開く" button, and a postback
// button that records "Setlogに参加した" without leaving LINE.
export function inviteSharedMessage(pairId: string, code: string, url: string): LineMessage {
  return {
    type: "template",
    altText: `相手がSetlog招待を共有しました（招待コード: ${code}）`,
    template: {
      type: "buttons",
      text: `相手がSetlog招待を共有しました\n招待コード: ${code}`,
      actions: [
        { type: "uri", label: "Setlogを開く", uri: url },
        {
          type: "postback",
          label: "Setlogに参加した",
          data: `action=join_setlog&pairId=${pairId}`,
          displayText: "Setlogに参加した",
        },
      ],
    },
  };
}
