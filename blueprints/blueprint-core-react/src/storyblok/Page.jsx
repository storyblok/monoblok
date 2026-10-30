import { StoryblokComponent, storyblokEditable } from '@storyblok/react';

export default function Page({ blok }) {
	return (
		<main {...storyblokEditable(blok)}>
			{blok.body?.map((nestedBlok, index) => (
				<StoryblokComponent blok={nestedBlok} key={nestedBlok._uid || index} />
			))}
		</main>
	);
}
