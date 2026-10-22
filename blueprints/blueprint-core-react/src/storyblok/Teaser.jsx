import { storyblokEditable } from '@storyblok/react';

export default function Teaser({ blok }) {
	return (
		<div {...storyblokEditable(blok)} className="teaser">
			<h2>{blok.headline}</h2>
		</div>
	);
}
