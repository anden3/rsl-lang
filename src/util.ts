export function getLocalISOString(date: Date) {
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    const newDate = new Date(date.getTime() - offsetMs).toISOString();
    return newDate.split('.')[0].replace('T', ' ').replace(new RegExp(':', 'g'), '-');
}