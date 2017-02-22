#!/bin/node
const util = require('util')


/**************************************************************************************************/
/********************SCANSION**********************************************************************/
/**************************************************************************************************/
/**************************************************************************************************/

const CONSONANTS = `(?:
	k,	c,	ṭ,	t,	p,
	kh,	ch,	ṭh,	th,	ph, 
	g,	j,	ḍ,	d,	b,
	gh,	jh,	ḍh,	dh,	bh, 
	ṅ,	ñ,	ṇ,	n,	m,
	h,	y,	r,	l,	v,
	ḷh,	ḷ,	s,
	dr, by,	br,	vy)` // S1.5 Soft Conjunts (by,br,vy; but not always...TODO), p17 
.replace(/\s/g,"").replace(/,/g,"|")
const VOWELS = `(?:[
	a,	i,	u,
	ā,	ī,	ū,
	e,	o])`	// 
.replace(/\s|,/g,"")
const SYLLABOUS_REX = new RegExp("^"+[		//TODO: there may or may not be something wrong here
	"(v(?=cv),?|cv,?(?=cv)|cv,?(?=v))",	// open syllables
	"|(vc,?(?=c)|cvc,?(?=c)|cvṃ,?(?=.))",	// closed syllables
	"|(cv$|vc$|cvc$|cvṃ$)",			// pādantagaru
].join("").replace(/v/g,VOWELS).replace(/c/g,CONSONANTS))

//TODO
// punctuation and spaces for resolution & replacement handling 1.15, 1.16 (and readability)...
//~ 5 Conjuncts not making position [for prior syllable] (tvaṃ dvāra nhātaka etc)
//  9 Vowel changes (e/o&open seems to be light at end of a word)
//~13 Ending iti handler (just manual for now)

class Scanner {
	constructor(line) {
		this.line = line
	}

	next() {
		let match = SYLLABOUS_REX.exec(this.line)
		if (!match || match.index > 0) throw this.line
		this.line = this.line.substring(match[0].length)

		let scansion = match[3] ? "X" : 
			(match[1] && /[aiu]$/.test(match[0]) ? "1" : "2")
			+ (match[0].endsWith(",") ? "," : "")
		return scansion + ("     ".substr(0, match[0].length - scansion.length))
	}
}

/**************************************************************************************************/
/********************FITNESS***********************************************************************/
/**************************************************************************************************/
/**************************************************************************************************/

const MORAE = /[12xivyWN]/g; // cf. S1.17 Symbols
const MORAE_MAP = {
	1:"1",
	2:"2",
	X:"X",				// pādantagaru
	x:"([12])",			// pādādigaru
	i:"[12]",
	v:"(?:1 *1|2)",
	y:"(?:1 *1|2|1)",
	W:"(?:1 *2 *1|2 *2)",
	N:"(?:1 *1 *2|2 *1 *1)",
	",":","
}

class Fitter {
	constructor(scansion, structure) {
		this.scansion = scansion
		this.structure = structure
	}

	hasNext() {
		return this.structure.length && this.scansion.length
	}

	next() {
		if (this.structure.length == 0) throw "LONG_LINE"
		if (this.scansion.length == 0) throw "SHORT_LINE"
		let morae = this.structure[0];
		let match = this.scansion.match(new RegExp("^"+MORAE_MAP[morae] + "[ ]*"))

		if (!match || match.index > 0) return null
		this.scansion = this.scansion.substring(match[0].length)
		this.structure = this.structure.substring(1);
		return morae + "       ".substr(0, match[0].length - 1)

	}
}

/**************************************************************************************************/
/********************FITNESS***********************************************************************/
/**************************************************************************************************/
/**************************************************************************************************/

//TODO matchedness: position of non-matching
//TODO resolutions & replacements 1.15, 1.16 ff 21
//TODO gaṇa alignment
//TODO syllable count validation
//TODO measure count validation
//TODO multiline validation
class MetreTemplate {
	constructor(measureStructures, 
		lineIndexToStructureVariationsFunction = lineIndex => Object.keys(this.structs), 
		scansionAdjustmentFunction = (scansion,variation,match) => match ? scansion : null) {
		this.structs = measureStructures
		this.regexes = {}
		this.varfunc = lineIndexToStructureVariationsFunction
		this.adjfunc = scansionAdjustmentFunction

		// Regexify
		Object.keys(this.structs).forEach(name=>{
			let regex = this.structs[name].replace(MORAE, match => MORAE_MAP[match])
			this.regexes[name] = new RegExp("^" + regex + "$")
		})
	}

	getFitting(line, index) {
		//Scansion
		let scansion = ""
		for (let scanner = new Scanner(line); 
			scanner.line; 
			scansion+=scanner.next());

		//Fitness
		return {
			scansion:scansion,
			fitness:this.varfunc(index).map(variation => {

				let fitting = ""
				let a = ""
				for (let fitter = new Fitter(scansion, this.structs[variation]); 
					fitter.scansion && (a = fitter.next()); 
					fitting+=a);
				return {
					name:variation,
					matches: this.regexes[variation].test(scansion.replace(/ /g, "")),
					fitting: fitting,
					adjustedScansion:this.adjfunc(scansion, variation, scansion.match(this.structs[variation])),
				}
			})
		}
	}
}

/**************************************************************************************************/
/********************METRES************************************************************************/
/**************************************************************************************************/
/**************************************************************************************************/

MetreTemplate.Templates = {
	"Old Gīti":new MetreTemplate(
		{
			normal: 	"y2Wv2i,2iv2Wv2X",
			n2:  		"y2v2v2i,2iv2Wv2X",
			n6:  		"y2Wv2i,2iv2v2v2X",
			n26: 		"y2v2v2i,2iv2v2v2X",
			n4: 		"y2Wv2x,2v2Wv2X",
			n24:  		"y2v2v2x,2v2Wv2X",
			n46:  		"y2Wv2x,2v2v2v2X",
			n246: 		"y2v2v2x,2v2v2v2X",

			extended: 	"y2Wv2i,v2v2Wv2X",
			e2: 		"y2v2v2i,v2v2Wv2X",
			e6: 		"y2Wv2i,v2v2v2v2X",
			e26: 		"y2v2v2i,v2v2v2v2X",
		},
		undefined,
		(scansion,variation,match) => {
			if (!match) return null
			scansion.replace(/^12/,"X2")
			if (variation.includes("4"))
				scansion.replace(/[12],/,"x")
			return scansion
		}
	),
	"Tuṭṭhubha (Triṣṭubh)":new MetreTemplate(
		{
			n1: 	"y212i1i212x,y212i1i212X",
			n2: 	"y212i1i212x,y212i1i212X",
			n3: 	"y212i1i212x,y212i1i212X",
			n4: 	"y212i1i212x,y212i1i212X",
			n5: 	"y212i1i212x,y212i1i212X",
			n6: 	"y212i1i212x,y212i1i212X",
		}
	)
}

/**************************************************************************************************/
/********************MAIN**************************************************************************/
/**************************************************************************************************/
/**************************************************************************************************/

const poem = `
	karaṇīyamatthakusalena, yantasantaṃ padaṃ abhisamecca
	sakko ujū ca sūjū ca, suvaco cassa mudu anatimānī
	santussako ca subharo ca, appakicco ca sallahukavutti
	santindriyo ca nipako ca, appagabbho kulesvananugiddho
	na ca khuddamācare kiñci, yena viññū pare upavadeyyuṃ
	sukhinova khemino hontu, sabbasattā bhavantu sukhitattā
	ye keci pāṇabhūtatthi, tasā vā thāvarā vanavasesā
	dīghā vā yeva mahantā, majjhimā rassakā aṇukathūlā
	diṭṭhā vā yeva adiṭṭhā, ye va dūre vasanti avidūre
	bhūtā va sambhavesī va, sabbasattā bhavantu sukhitattā
	na paro paraṃ nikubbetha, nātimaññetha katthaci na kañci
	byārosanā paṭighasaññā, nāññamaññassa dukkhamiccheyya
	mātā yathā niyaṃ putta, māyusā ekaputtamanurakkhe
	evampi sabbabhūtesu, mānasaṃ bhāvaye aparimāṇaṃ
	mettañca sabbalokasmi, mānasaṃ bhāvaye aparimāṇaṃ
	uddhaṃ adho ca tiriyañca, asambādhaṃ averamasapattaṃ
	tiṭṭhaṃ caraṃ nisinno va, sayāno yāvatāssa vitamiddho
	etaṃ satiṃ adhiṭṭheyya, brahmametaṃ vihāramidhamāhu
	diṭṭhiñca anupaggamma, sīlavā dassanena sampanno
	kāmesu vinaya gedhaṃ, na hi jātuggabbhaseyya puna reti`
.trim().replace(/[ ]|\t/g,"").split("\n")

const poem2 = `
	Karaṇīyamatthakusalena, Yanta santaṃ padaṃ abhisamecca
	Sakko ujū ca suhujū ca, Sūvaco cassa mudu anatimānī
	Santussako ca subharo ca, Appakicco ca sallahukavutti
	Santindriyo ca nipako ca, Appagabbho kulesvananugiddho
	Na ca khuddamācare kiñci, Yena viññū pare upavadeyyuṃ
	Sukhino va khemino hontu, Sabbasattā bhavantu sukhitattā
	Ye keci pāṇabhūtatthi, Tasā vā thāvarā vanavasesā
	Dīghā vā ye va mahantā, Majjhimā rassakā aṇukathūlā
	Diṭṭhā vā ye va adiṭṭhā, Ye va dūre vasanti avidūre
	Bhūtā va sambhavesī va, Sabbasattā bhavantu sukhitattā
	Na paro paraṃ nikubbetha, Nātimaññetha katthaci na kañci
	Byārosanā paṭighasañña, Nāññamaññassa dukkhamiccheyya
	Mātā yathā niyaṃputta, Māyusā ekaputtamanurakkhe
	Evampi sabbabhūtesu, Mānasaṃ bhāvaye aparimāṇaṃ
	Mettañca sabbalokasmi, Mānasaṃ bhāvaye aparimāṇaṃ
	Uddhaṃ adho ca tiriyañca, Asambādhaṃ averamasapattaṃ
	Tiṭṭhaṃ caraṃ nisinno va, Sayāno yāvatāssa vitamiddho
	Etaṃ satiṃ adhiṭṭheyya, Brahmametaṃ vihāramidhamāhu
	Diṭṭhiñca anupaggamma, Sīlavā dassanena sampanno
	Kāmesu vinaya gedhaṃ, Na hi jātuggabbhaseyya punareti`
.toLowerCase().trim().replace(/[ ]|\t/g,"").split("\n")

console.log(util.inspect(
	poem.map(
		(line, index) => ({
			line:line,
			fit:Object.keys(MetreTemplate.Templates).map(
				(metre) => MetreTemplate.Templates[metre].getFitting(line, index) 
			)
		})
	).map((obj)=>(
		{
			line:obj.line,
			scan:obj.fit[1].scansion, 
			fitt: obj.fit[1].fitness.map(
				(fit)=>"   "+fit.fitting
			),
			matches:obj.fit[1].fitness.reduce(
				(res,fit)=>fit.matches ? (res?res:"")+"|"+fit.name : res,
				null
			)
		}
	))
, {showHidden:false, depth:null, colors:true}))



