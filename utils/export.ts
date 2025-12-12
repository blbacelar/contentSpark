import { ContentIdea } from '../types';
import { format } from 'date-fns';

export const exportToCSV = (ideas: ContentIdea[]) => {
    const headers = ['Title', 'Date', 'Time', 'Platform', 'Caption', 'Status'];
    const rows = ideas.map(idea => [
        `"${idea.title.replace(/"/g, '""')}"`,
        idea.date || '',
        idea.time || '',
        `"${idea.platform.join(', ')}"`,
        `"${(idea.caption || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        idea.status
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    downloadFile(csvContent, 'content-calendar.csv', 'text/csv');
};

export const exportToICS = (ideas: ContentIdea[]) => {
    let icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ContentSpark//Content Calendar//EN',
        'CALSCALE:GREGORIAN'
    ];

    ideas.filter(i => i.date).forEach(idea => {
        // Default to 9 AM if no time set, or parse time
        const [hours, minutes] = (idea.time || '09:00').split(':').map(Number);
        const dateParts = idea.date!.split('-').map(Number);

        // Create Date object (months are 0-indexed in JS)
        const startDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], hours, minutes);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

        const formatICSDate = (date: Date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const description = `${idea.caption || ''}\\n\\nStatus: ${idea.status}\\nPlatform: ${idea.platform.join(', ')}`;

        icsContent.push(
            'BEGIN:VEVENT',
            `UID:${idea.id}@contentspark.app`,
            `DTSTAMP:${formatICSDate(new Date())}`,
            `DTSTART:${formatICSDate(startDate)}`,
            `DTEND:${formatICSDate(endDate)}`,
            `SUMMARY:${idea.title}`,
            `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
            'END:VEVENT'
        );
    });

    icsContent.push('END:VCALENDAR');

    downloadFile(icsContent.join('\r\n'), 'content-calendar.ics', 'text/calendar');
};

const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
