import { storyblokEditable } from '@storyblok/react';

export default function Feature({ blok }) {
	return (
		<div {...storyblokEditable(blok)} className="feature">
			<span>{blok.name}</span>
		</div>
	);
}
