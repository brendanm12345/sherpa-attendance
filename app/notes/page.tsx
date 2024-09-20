import { createClient } from '@/utils/supabase/server';

export default async function Notes() {
    const supabase = createClient();
    const { data } = await supabase.from("users").select();
    console.log(data);

    return <pre>{JSON.stringify(data, null, 2)}</pre>
}
