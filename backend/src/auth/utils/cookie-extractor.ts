export const cookieExtractor = (cookieName: string) => {
  return (req: any) => {
    if (!req?.headers?.cookie) return null;

    const cookies = req.headers.cookie.split(';').map(c => c.trim());

    const target = cookies.find(c => c.startsWith(`${cookieName}=`));

    if (!target) return null;

    return target.split('=')[1];
    };
};
