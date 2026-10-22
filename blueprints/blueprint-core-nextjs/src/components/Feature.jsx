import { storyblokEditable } from '@storyblok/react/rsc';

const Feature = ({ blok }) => {
	return (
		<div className="feature" {...storyblokEditable(blok)}>
			<span>{blok.name}</span>
		</div>
	);
};

export default Feature;
