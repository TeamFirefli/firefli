const randomTextFromArray = (texts: string[]) => {
	return texts[Math.floor(Math.random() * texts.length)];
};

const randomText = (name: string) => {
	const morningOnlyTexts = [
		`Good morning, ${name} ☀️`,
		`Rise and shine, ${name}! Firefli’s burning bright today 🔥`,
		`Let’s spark up a great day, ${name} ✨`,
		`Wake up and light it up, ${name} 💡`,
		`Coffee and Firefli energy for you, ${name} ☕️`,
		`Hey ${name}, let’s ignite some productivity!`,
		`Sunrise and new ideas, ${name} 🌅`,
		`Ready to blaze a trail today, ${name}?`,
		`Shine on, ${name}! Firefli’s got your back.`,
		`Let’s get glowing, ${name} 💫`,
		`Fresh start, fresh sparks, ${name} ✨`,
		`Light the fuse on your goals, ${name}.`,
		`Firefli mornings: powered by ambition and you, ${name}.`,
		`Let’s make today brilliant, ${name}!`,
		`The world’s brighter with you in it, ${name} 🔆`,
		`Rise, shine, and set the pace, ${name} 🏃‍♂️`,
		`Let’s turn up the heat, ${name} 🔥`,
		`New day, new flames, ${name} 🔥`,
		`Let’s light up those tasks, ${name}!`,
		`Firefli: where your morning starts strong, ${name}.`,
		`Shine bright, ${name}! The day’s yours ☀️`,
		`Let’s get glowing, ${name} ✨`,
		`Firefli mornings: let’s go, ${name}!`,
		`You’re the spark, ${name} 💡`,
		`Let’s blaze through the morning, ${name} 🔥`,
		`Good vibes and good light, ${name} 🌞`,
		`Let’s set the day on fire (in a good way), ${name} 🔥`,
		`Shine on, ${name}! Firefli’s with you`,
		`Let’s make it a legendary morning, ${name} 🏆`,
		`Firefli: powering up your day, ${name}`
	];

	const afternoonOnlyTexts = [
		`Good afternoon, ${name} 🌞`,
		`Keep the fire burning, ${name} ⛺`,
		`How’s your spark, ${name}?`,
		`Let’s keep glowing, ${name} ✨`,
		`Halfway there, ${name}! Firefli’s cheering you on`,
		`Let’s fuel up for the afternoon, ${name} ⛽️`,
		`You’re on fire, ${name}! Keep it up 🔥`,
		`Let’s light up the rest of the day, ${name} 💡`,
		`Still shining, ${name}? Firefli’s with you.`,
		`Let’s blaze through those tasks, ${name}!`,
		`Need a recharge? Firefli’s got you, ${name}.`,
		`Keep the momentum, ${name} 🚀`,
		`Let’s turn sparks into results, ${name} 💥`,
		`You’re glowing, ${name}!`,
		`Firefli afternoons: productivity in motion, ${name} 🛠️`,
		`Let’s keep the flame alive, ${name} 🔥`,
		`Don’t forget to hydrate, ${name} 💧`,
		`Ping! Firefli’s checking in on you, ${name} 🛎️`,
		`Let’s make this afternoon count, ${name} 🧠`,
		`You’re the light in this workspace, ${name} 💡`,
		`Keep shining, ${name}! Firefli’s proud of you`,
		`Let’s power through, ${name} ⚡️`,
		`Firefli: fueling your afternoon, ${name}`,
		`Let’s get those wins, ${name} 🏆`,
		`You’re unstoppable, ${name} 🚀`,
		`Let’s keep the fire alive, ${name} 🔥`,
		`Firefli: your productivity partner, ${name}`,
		`Let’s make it a brilliant afternoon, ${name} 🌞`,
		`You’re the spark that keeps us going, ${name} ✨`
	];

	const nightOnlyTexts = [
		`Good evening, ${name} 🌙`,
		`Winding down, ${name}? Firefli’s still glowing`,
		`Hope your day was bright, ${name} 🌆`,
		`Relax and recharge, ${name} 🔋`,
		`Evening vibes, Firefli style, ${name} ✨`,
		`Time to slow down and reflect, ${name} 🧘`,
		`The night’s aglow, ${name} 🌌`,
		`Great job today, ${name}! Firefli’s proud`,
		`Sweet dreams, ${name} 😴`,
		`Firefli never sleeps, but you should soon, ${name} 💤`,
		`The night is calm, ${name}. Time to relax 🌙`,
		`Logging off soon, ${name}? You’ve earned it!`,
		`Recharge mode: Firefli and ${name}.`,
		`Even fireflies need rest - so do you, ${name}.`,
		`Thanks for shining today, ${name} 💙`,
		`Night shift or night chill? You decide, ${name}.`,
		`May your dreams be bug-free, ${name} 💤`,
		`Another day complete. Well done, ${name} 🎮`,
		`Mission complete for today, ${name}.`,
		`Sending good energy for tomorrow, ${name} 🔮`,
		`Firefli: lighting up your night, ${name}`,
		`You made today brighter, ${name} ✨`,
		`Rest easy, ${name}. Firefli’s here for you`,
		`Let the glow guide you, ${name} 🌙`,
		`Good night, ${name}! Shine again tomorrow`,
		`Firefli: powering down, ${name} 💤`,
		`You’re the light in the dark, ${name} 🔦`,
		`Let’s recharge for another bright day, ${name} 🔋`
	];

	const lateNightTexts = [
		`Still awake, ${name}? Firefli respects the grind.`,
		`Burning the midnight oil, ${name}? 🔥`,
		`Late-night coding or just vibing, ${name}? 💻`,
		`You, me, and the glow. Let’s vibe, ${name} 🪩`,
		`Insomniacs anonymous: Firefli edition, ${name} 😴💤`,
		`Hope you’re doing okay, ${name}. Remember to rest soon!`,
		`Firefli’s still glowing, and so are you, ${name} ✨`,
		`Night owl mode: activated, ${name} 🦉`,
		`Don’t forget to power down, ${name}.`,
		`Firefli: keeping you company, ${name}.`,
		`You’re the last spark online, ${name}!`,
		`Let’s make the most of the night, ${name}.`,
		`Rest is important, ${name}. Firefli says so!`,
		`Late night, bright mind, ${name} 💡`,
		`Firefli: glowing with you, ${name}.`
	];

	const hour = new Date().getHours();

	if (hour >= 20) return randomTextFromArray(nightOnlyTexts);
	if (hour >= 12) return randomTextFromArray(afternoonOnlyTexts);
	if (hour >= 4) return randomTextFromArray(morningOnlyTexts);
	return randomTextFromArray(lateNightTexts);
};

export default randomText;