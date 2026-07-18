module.exports = {
    // === BOT UTAMA ===
    botToken: process.env.BOT_TOKEN || '8990796824:AAHBNt2Dy5upueM6Hc9Uim1YM_US9GaDP6c',
    botName: process.env.BOT_NAME || 'HangzStore',
    
    // === OWNER ===
    ownerId: Number(process.env.OWNER_ID || 2102908949),
    ownerIds: [String(process.env.OWNER_ID || 2102908949)],
    
    // === FORCE JOIN ===
    channels: ['@inpoapkmod'],
    group: '@disscussionpolsekjaktim',
    
    // === NOTIFIKASI ===
    notifChannel: '@datahngz',
    
    // === GAMBAR MENU ===
    startImage: 'https://athars.space/uploads/6ca355d1.png',
    
    // === KOIN & REWARD ===
    dailyClaimAmount: 5000,
    dailyClaimCooldownMs: 24 * 60 * 60 * 1000,
    referralBonus: 30000,
    referralBonusNewUser: 2000,
    welcomeBonus: 2000,
    
    // === ANIMELOVERS VIP ===
    animeloversDurasiMap: {
        '1bulan': 'Mzk3MjA4NDM3NjFfM18x',
        '3bulan': 'Mzk3MjA4NDM3NjFfM18z',
        '1tahun': 'Mzk3MjA4NDM3NjFfM18xMg=='
    },
    animeloversApiHeaders: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Accept': 'application/json'
    },
    animeloversName: 'wibu',
    animeloversProfile: 'https://lh3.googleusercontent.com/a/ACg8ocIk6mQVP02KEycB9_MYhhtyiN8eyDaz_N3dp3OwwIDN30ri0XYS=s288-c-no',
    
    // === ALIGHT MOTION ===
    alightApiBase: 'https://am-prem.vxz.my.id',
    
    // === OBFUSCATE ===
    maxFileSize: 5 * 1024 * 1024, // 5 MB
    
    // === LAINNYA ===
    adminId: Number(process.env.ADMIN_ID || 2102908949),
    tmpDir: './tmp',
    dbFile: './database.json'
};