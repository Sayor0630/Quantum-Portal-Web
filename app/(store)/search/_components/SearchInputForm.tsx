'use client';
import { TextInput, Button, Group } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, FormEvent } from 'react'; // Added FormEvent

export default function SearchInputForm({ initialQuery = '' }: { initialQuery?: string }) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState(initialQuery);

    // Sync searchTerm with initialQuery if it changes (e.g., browser back/forward)
    useEffect(() => {
        setSearchTerm(initialQuery);
    }, [initialQuery]);

    const handleSearch = (event?: FormEvent<HTMLFormElement>) => { // Typed event
        if (event) event.preventDefault();
        if (searchTerm.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
        } else {
            // If search term is empty, navigate to /search to clear results or show default state
            router.push('/search');
        }
    };

    return (
        <form onSubmit={handleSearch}>
            <Group>
                <TextInput
                    placeholder="Search for products..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.currentTarget.value)}
                    style={{ flexGrow: 1 }}
                    leftSection={<IconSearch size={18} stroke={1.5} />} // Adjusted icon size/stroke
                    aria-label="Search products"
                />
                <Button type="submit">Search</Button>
            </Group>
        </form>
    );
}
