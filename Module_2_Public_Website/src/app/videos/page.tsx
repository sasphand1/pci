import {redirect} from 'next/navigation';
/** Video lists came from the old creator tables, which are retired. Rankings and profiles replace them. */
export default function Videos(){redirect('/creators');}
