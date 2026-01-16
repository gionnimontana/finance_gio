const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ~500 common Italian words for password generation
const ITALIAN_WORDS = [
    'acqua', 'albero', 'alto', 'amore', 'amico', 'anno', 'antico', 'aperto', 'aria', 'arte',
    'bello', 'bianco', 'bocca', 'bosco', 'braccio', 'breve', 'buono', 'caldo', 'camera', 'campo',
    'cane', 'cantare', 'capello', 'capo', 'carta', 'casa', 'cavallo', 'cena', 'centro', 'cercare',
    'chiave', 'chiudere', 'cielo', 'circa', 'classe', 'colore', 'come', 'conto', 'corpo', 'cosa',
    'costa', 'cuore', 'dentro', 'destro', 'dietro', 'dire', 'dolce', 'donna', 'dopo', 'dormire',
    'dove', 'drago', 'duro', 'estate', 'essere', 'faccia', 'famiglia', 'fare', 'favola', 'felice',
    'ferro', 'festa', 'fiore', 'fiume', 'foglia', 'fondo', 'forma', 'forte', 'fortuna', 'freddo',
    'fresco', 'fronte', 'frutto', 'fuoco', 'fuori', 'gamba', 'gatto', 'gelato', 'gente', 'giallo',
    'giardino', 'gioco', 'giorno', 'giovane', 'giro', 'grande', 'grigio', 'gruppo', 'gusto', 'idea',
    'immagine', 'inizio', 'insieme', 'inverno', 'isola', 'labbro', 'lago', 'largo', 'latte', 'lavoro',
    'legge', 'legno', 'lento', 'leone', 'lettera', 'letto', 'libero', 'libro', 'luce', 'lunga',
    'lungo', 'luogo', 'madre', 'maestro', 'maggio', 'mano', 'mare', 'martello', 'mattina', 'meglio',
    'memoria', 'meno', 'mente', 'mezzo', 'miele', 'miglio', 'minuto', 'mondo', 'monte', 'morire',
    'morte', 'mosca', 'movimento', 'musica', 'nascere', 'natura', 'nave', 'nero', 'neve', 'nido',
    'nobile', 'nome', 'nord', 'notte', 'nove', 'nube', 'numero', 'nuovo', 'occhio', 'oggi',
    'ogni', 'ombra', 'onda', 'opera', 'ora', 'ordine', 'oro', 'orso', 'padre', 'paese',
    'palla', 'pane', 'parco', 'parola', 'parte', 'partire', 'passare', 'passo', 'pasta', 'paura',
    'pelle', 'pensare', 'pensiero', 'perla', 'persona', 'pesce', 'piano', 'pianta', 'piatto', 'piccolo',
    'piede', 'pieno', 'pietra', 'pino', 'pioggia', 'poco', 'ponte', 'porta', 'portare', 'porto',
    'posto', 'potere', 'povero', 'pranzo', 'prato', 'premio', 'prendere', 'presto', 'prima', 'primo',
    'principe', 'problema', 'profondo', 'pronto', 'proprio', 'pubblico', 'punto', 'puro', 'quadro', 'quando',
    'quanto', 'quello', 'questo', 'quieto', 'radice', 'ragazzo', 'ragione', 'rapido', 'regalo', 'regina',
    'regno', 'ricco', 'ridere', 'riga', 'risposta', 'ritmo', 'riva', 'roccia', 'rosa', 'rosso',
    'rumore', 'sabbia', 'sacro', 'sala', 'sale', 'salire', 'salto', 'salute', 'sangue', 'santo',
    'sapere', 'scala', 'scena', 'scienza', 'scrivere', 'scuola', 'secco', 'secolo', 'secondo', 'segreto',
    'seguire', 'sempre', 'senso', 'sentire', 'sera', 'sereno', 'servo', 'sette', 'signore', 'silenzio',
    'simile', 'sistema', 'sogno', 'sole', 'solido', 'solo', 'sonno', 'sopra', 'sorella', 'sorte',
    'sotto', 'spalla', 'spazio', 'specchio', 'spesso', 'spirito', 'sporco', 'stagione', 'stampa', 'stanco',
    'stanza', 'stella', 'stesso', 'storia', 'strada', 'studio', 'subito', 'succo', 'suono', 'sveglio',
    'tavolo', 'tempo', 'tenere', 'terra', 'testa', 'tigre', 'toccare', 'torre', 'treno', 'triste',
    'troppo', 'trovare', 'tutto', 'ultimo', 'umano', 'umido', 'unico', 'unire', 'uomo', 'usare',
    'uscire', 'utile', 'vacanza', 'valore', 'vecchio', 'vedere', 'vela', 'veloce', 'vendere', 'venire',
    'vento', 'verde', 'vergogna', 'verso', 'vestire', 'vetro', 'via', 'viaggio', 'vicino', 'vincere',
    'vino', 'viola', 'virtù', 'viso', 'vita', 'vittoria', 'vivere', 'vivo', 'voce', 'volare',
    'volere', 'volta', 'vuoto', 'zucchero', 'fiume', 'sasso', 'nuvola', 'quercia', 'balena', 'aquila',
    'falco', 'serpente', 'farfalla', 'ragno', 'formica', 'ape', 'cigno', 'cervo', 'lupo', 'volpe',
    'coniglio', 'pecora', 'mucca', 'toro', 'maiale', 'gallo', 'pollo', 'anatra', 'colomba', 'corvo',
    'gufo', 'rana', 'tartaruga', 'delfino', 'squalo', 'granchio', 'polpo', 'stella', 'luna', 'pianeta',
    'cometa', 'galassia', 'universo', 'sponda', 'collina', 'valle', 'cascata', 'sorgente', 'ruscello', 'oceano',
    'deserto', 'foresta', 'giungla', 'prateria', 'ghiaccio', 'fulmine', 'tuono', 'arcobaleno', 'nebbia', 'rugiada',
    'aurora', 'tramonto', 'alba', 'crepuscolo', 'ombra', 'chiaro', 'scuro', 'mattone', 'cemento', 'legna',
    'carbone', 'argento', 'bronzo', 'rame', 'diamante', 'rubino', 'smeraldo', 'zaffiro', 'cristallo', 'marmo',
    'granito', 'sabbia', 'argilla', 'fango', 'polvere', 'cenere', 'fumo', 'vapore', 'fiamma', 'scintilla',
    'candela', 'lampada', 'torcia', 'faro', 'finestra', 'tetto', 'muro', 'pavimento', 'soffitto', 'balcone',
    'giardino', 'cortile', 'cancello', 'recinto', 'sentiero', 'viale', 'piazza', 'fontana', 'statua', 'monumento',
    'tempio', 'chiesa', 'castello', 'palazzo', 'torre', 'ponte', 'tunnel', 'porto', 'aeroporto', 'stazione',
    'mercato', 'negozio', 'bottega', 'fabbrica', 'officina', 'mulino', 'forno', 'cucina', 'bagno', 'cantina',
    'soffitta', 'garage', 'magazzino', 'granaio', 'stalla', 'pollaio', 'alveare', 'nido', 'tana', 'caverna'
];

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');

// Default templates for new users
const DEFAULT_ASSETS_SCHEMA = {
    assets: [],
    viewGroups: ['Liquidity', 'Crypto', 'Gold', 'Houses', 'Equity'],
    prevMonthTotal: null,
    initYearNetworth: null
};

const DEFAULT_HISTORICAL_DATA = [];

/**
 * Generate a password of 5 random Italian words joined by dashes
 */
const generatePassword = () => {
    const words = [];
    for (let i = 0; i < 5; i++) {
        const randomIndex = Math.floor(Math.random() * ITALIAN_WORDS.length);
        words.push(ITALIAN_WORDS[randomIndex]);
    }
    return words.join('-');
};

/**
 * Hash a password using SHA-256
 */
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

/**
 * Get the data directory path for a user (based on hashed password)
 */
const getUserDataDir = (passwordHash) => {
    return path.join(USERS_DIR, passwordHash);
};

/**
 * Check if a user folder exists for the given password hash
 */
const userExists = (passwordHash) => {
    const userDir = getUserDataDir(passwordHash);
    return fs.existsSync(userDir);
};

/**
 * Create a new user folder with default data files
 */
const createUser = (passwordHash) => {
    const userDir = getUserDataDir(passwordHash);
    
    // Create user directory
    fs.mkdirSync(userDir, { recursive: true });
    
    // Create default assets schema
    const assetsPath = path.join(userDir, 'assetsSchema.json');
    fs.writeFileSync(assetsPath, JSON.stringify(DEFAULT_ASSETS_SCHEMA, null, 2), 'utf8');
    
    // Create default historical data
    const historyPath = path.join(userDir, 'historicalData.json');
    fs.writeFileSync(historyPath, JSON.stringify(DEFAULT_HISTORICAL_DATA, null, 2), 'utf8');
    
    return true;
};

/**
 * Express route handler: Generate new user
 * POST /auth/generate
 * Returns: { password: "word1-word2-word3-word4-word5" }
 */
const handleGenerate = (req, res) => {
    try {
        const password = generatePassword();
        const passwordHash = hashPassword(password);
        
        // Ensure users directory exists
        if (!fs.existsSync(USERS_DIR)) {
            fs.mkdirSync(USERS_DIR, { recursive: true });
        }
        
        // Check for collision (extremely unlikely but handle it)
        if (userExists(passwordHash)) {
            // Regenerate if collision
            return handleGenerate(req, res);
        }
        
        createUser(passwordHash);
        
        res.json({ password });
    } catch (error) {
        console.error('Error generating user:', error);
        res.status(500).json({ error: 'Failed to generate user' });
    }
};

/**
 * Express route handler: Validate password
 * POST /auth/validate
 * Body: { password: "word1-word2-word3-word4-word5" }
 * Returns: { valid: true/false }
 */
const handleValidate = (req, res) => {
    try {
        const { password } = req.body || {};
        
        if (!password || typeof password !== 'string') {
            return res.status(400).json({ valid: false, error: 'Password required' });
        }
        
        const passwordHash = hashPassword(password);
        const valid = userExists(passwordHash);
        
        res.json({ valid });
    } catch (error) {
        console.error('Error validating user:', error);
        res.status(500).json({ valid: false, error: 'Failed to validate' });
    }
};

/**
 * Express middleware: Authenticate user from X-User-Password header
 * Sets req.userPasswordHash if valid, returns 401 if invalid
 */
const authMiddleware = (req, res, next) => {
    const password = req.headers['x-user-password'];
    
    if (!password) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const passwordHash = hashPassword(password);
    
    if (!userExists(passwordHash)) {
        return res.status(401).json({ error: 'Invalid password' });
    }
    
    req.userPasswordHash = passwordHash;
    next();
};

module.exports = {
    generatePassword,
    hashPassword,
    getUserDataDir,
    userExists,
    createUser,
    handleGenerate,
    handleValidate,
    authMiddleware,
    USERS_DIR
};
