import type {Metadata} from 'next';
import {PageHeading} from '@pci/ui';
export const metadata:Metadata={title:'Methodology'};
export default function Methodology(){return <div className="container"><PageHeading eyebrow="Transparency" title="How the numbers work" description="What the index does and does not measure."/><article className="card readable">
<h2>Selection is curated</h2><p>The index covers a selected group of individual creators on YouTube and Instagram. Membership is an editorial decision, not a claim that these are the largest creators in Pakistan. TikTok is not included.</p>
<h2>Where the numbers come from</h2><p>Numbers are the ones YouTube and Instagram report publicly, fetched once a day around 09:00 Pakistan time. YouTube rounds subscriber counts to three significant figures, so close neighbours can be tied.</p>
<h2>The three wheel rankings</h2><p><strong>Most Subscribed</strong> adds a person&apos;s followers across their accounts. These are account counts, not unique people, and the same person may follow someone on both platforms. <strong>Most Viewed</strong> is YouTube lifetime channel views; Instagram does not provide an equivalent total. <strong>Most Active</strong> is the number of posts in the last 30 days. It is counted from the most recent posts a platform returns, so a very active account can be under-counted.</p>
<h2>Platform and category rows</h2><p>The YouTube and Instagram rows rank by that platform&apos;s own followers. Each category row ranks the people in that category by followers across their accounts.</p>
<h2>Missing numbers are never zero</h2><p>If an account hides its count, cannot be found, or its latest number is older than 7 days, that number is left out. A person with no usable number for a ranking is not ranked in it. Equal values share a rank.</p>
<h2>What is published</h2><p>Rankings are built from the stored numbers and checked automatically before they replace the live ones: no gaps, no duplicates, values that add up, and enough people with fresh numbers. If a check fails, the previous ranking stays up. When someone is removed from the index they disappear from every ranking at once and nobody else&apos;s numbers change.</p>
<h2>No influence score</h2><p>There is no hidden weighting, rating, revenue estimate or machine-learning ranking.</p>
<h2>Content neutrality</h2><p>A ranking is not an endorsement of a creator, an assessment of accuracy, or a measure of anyone&apos;s beliefs.</p>
<p>The data is also available as a read-only <a href="/docs">public API</a>.</p></article></div>}
