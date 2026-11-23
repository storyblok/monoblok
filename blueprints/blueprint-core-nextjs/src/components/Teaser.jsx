const Teaser = ({ block, editable }) => {
	return (
		<div className="teaser" {...editable}>
			<h1>{block.headline}</h1>
		</div>
	);
};

export default Teaser;
