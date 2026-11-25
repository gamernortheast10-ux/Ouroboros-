import gameBalloonImg from '../assets/images/game_balloon_1795441143575.jpg';
import gameChickenRoadImg from '../assets/images/game_chicken_road_1795441071291.jpg';
import gameCoinflipImg from '../assets/images/game_coinflip_1795441070948.jpg';
import gameColorPredictImg from '../assets/images/game_color_predict_1795441070959.jpg';
import gameCryptoJackpotImg from '../assets/images/game_crypto_jackpot_1795441071556.jpg';
import gameDragonTigerImg from '../assets/images/game_dragon_tiger_1795441071848.jpg';
import gameHiloImg from '../assets/images/game_hilo_1795441143736.jpg';
import gameLuckyWheelImg from '../assets/images/game_lucky_wheel_1795441071663.jpg';
import gameMinesImg from '../assets/images/game_mines_1795441072528.jpg';
import gamePlinkoImg from '../assets/images/game_plinko_1795441071862.jpg';
import gameRouletteImg from '../assets/images/game_roulette_1795441070923.jpg';
import gameRpsImg from '../assets/images/game_rps_1795441071042.jpg';
import gameStairsImg from '../assets/images/game_stairs_1795441070999.jpg';
import gameTowerImg from '../assets/images/game_tower_1795441071000.jpg';
import gameTradeLiveImg from '../assets/images/game_trade_live_1795441071724.jpg';
import gameTreasureImg from '../assets/images/game_treasure_1795441070974.jpg';

export type GameCategory = 'All' | 'Crash & Risk' | 'Casino & Wheel' | 'Cards & Duel' | 'Instant';

export interface GameCatalogItem {
  id: string;
  title: string;
  tag: string;
  category: Exclude<GameCategory, 'All'>;
  htmlPath: string;
  bannerImage: string;
  fallbackGradient: string;
  featured?: boolean;
}

export const GAME_CATEGORIES: GameCategory[] = [
  'All',
  'Crash & Risk',
  'Casino & Wheel',
  'Cards & Duel',
  'Instant',
];

export const GAMES_CATALOG: GameCatalogItem[] = [
  {
    id: 'aviator',
    title: 'Aviator',
    tag: 'Crash Flight',
    category: 'Crash & Risk',
    htmlPath: '/assets/aistudio/aviator_ouroboros.html',
    bannerImage: '',
    fallbackGradient: 'linear-gradient(135deg, #450a0a 0%, #991b1b 48%, #dc2626 100%)',
    featured: true,
  },
  {
    id: 'color-predict',
    title: 'Color Predict',
    tag: '24×7 Live Rounds',
    category: 'Instant',
    htmlPath: '/assets/aistudio/color-predict_b26f4cac.html',
    bannerImage: gameColorPredictImg,
    fallbackGradient: 'linear-gradient(135deg, #064e3b 0%, #4c1d95 50%, #991b1b 100%)',
    featured: true,
  },
  {
    id: 'chicken-road',
    title: 'Chicken Road',
    tag: 'Risk Run',
    category: 'Crash & Risk',
    htmlPath: '/assets/aistudio/chicken-road_8511d48e.html',
    bannerImage: gameChickenRoadImg,
    fallbackGradient: 'linear-gradient(135deg, #431407 0%, #9a3412 50%, #f59e0b 100%)',
    featured: true,
  },
  {
    id: 'crypto-jackpot',
    title: 'Crypto Jackpot',
    tag: 'Vault Spin',
    category: 'Casino & Wheel',
    htmlPath: '/assets/aistudio/crypto-jackpot_7703ae63.html',
    bannerImage: gameCryptoJackpotImg,
    fallbackGradient: 'linear-gradient(135deg, #422006 0%, #1e1b4b 55%, #eab308 100%)',
    featured: true,
  },
  {
    id: 'trade-live',
    title: 'Trade Live',
    tag: '24×7 Fast Chart',
    category: 'Instant',
    htmlPath: '/assets/aistudio/trade-live_f1aa2555.html',
    bannerImage: gameTradeLiveImg,
    fallbackGradient: 'linear-gradient(135deg, #022c22 0%, #1e1b4b 55%, #10b981 100%)',
  },
  {
    id: 'mines',
    title: 'Mines',
    tag: 'Gem Grid',
    category: 'Crash & Risk',
    htmlPath: '/assets/aistudio/mines_eca5b00d.html',
    bannerImage: gameMinesImg,
    fallbackGradient: 'linear-gradient(135deg, #082f49 0%, #1e1b4b 55%, #06b6d4 100%)',
  },
  {
    id: 'plinko',
    title: 'Plinko',
    tag: 'Drop Ball',
    category: 'Crash & Risk',
    htmlPath: '/assets/aistudio/plinko_5c700fd6.html',
    bannerImage: gamePlinkoImg,
    fallbackGradient: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 55%, #8b5cf6 100%)',
  },
  {
    id: 'dragon-tiger',
    title: 'Dragon Tiger',
    tag: 'Card Clash',
    category: 'Cards & Duel',
    htmlPath: '/assets/aistudio/dragon-tiger_47cd7443.html',
    bannerImage: gameDragonTigerImg,
    fallbackGradient: 'linear-gradient(135deg, #7f1d1d 0%, #1e1b4b 50%, #0284c7 100%)',
  },
  {
    id: 'lucky-wheel',
    title: 'Lucky Wheel',
    tag: 'Prize Spin',
    category: 'Casino & Wheel',
    htmlPath: '/assets/aistudio/lucky-wheel_21000458.html',
    bannerImage: gameLuckyWheelImg,
    fallbackGradient: 'linear-gradient(135deg, #3b0764 0%, #7e22ce 50%, #eab308 100%)',
  },
  {
    id: 'roulette',
    title: 'Roulette',
    tag: 'Table Wheel',
    category: 'Casino & Wheel',
    htmlPath: '/assets/aistudio/roulette_dc9866b2.html',
    bannerImage: gameRouletteImg,
    fallbackGradient: 'linear-gradient(135deg, #450a0a 0%, #18181b 55%, #065f46 100%)',
  },
  {
    id: 'hilo',
    title: 'Hi-Lo',
    tag: 'Higher Lower',
    category: 'Cards & Duel',
    htmlPath: '/assets/aistudio/hilo_66cd4a68.html',
    bannerImage: gameHiloImg,
    fallbackGradient: 'linear-gradient(135deg, #2e1065 0%, #111827 55%, #f59e0b 100%)',
  },
  {
    id: 'tower',
    title: 'Tower Climb',
    tag: 'Ascend',
    category: 'Crash & Risk',
    htmlPath: '/assets/aistudio/tower_8787ad60.html',
    bannerImage: gameTowerImg,
    fallbackGradient: 'linear-gradient(135deg, #2e1065 0%, #5b21b6 55%, #a855f7 100%)',
  },
  {
    id: 'balloon',
    title: 'Balloon Pop',
    tag: 'Pump & Cash',
    category: 'Crash & Risk',
    htmlPath: '/assets/aistudio/balloon_894694d5.html',
    bannerImage: gameBalloonImg,
    fallbackGradient: 'linear-gradient(135deg, #4a044e 0%, #6d28d9 55%, #ec4899 100%)',
  },
  {
    id: 'stairs',
    title: 'Stairs Climb',
    tag: 'Step Path',
    category: 'Crash & Risk',
    htmlPath: '/assets/aistudio/stairs_cbd5c97c.html',
    bannerImage: gameStairsImg,
    fallbackGradient: 'linear-gradient(135deg, #064e3b 0%, #1e1b4b 55%, #10b981 100%)',
  },
  {
    id: 'treasure',
    title: 'Treasure Boxes',
    tag: 'Chest Pick',
    category: 'Instant',
    htmlPath: '/assets/aistudio/treasure_39f8b6cc.html',
    bannerImage: gameTreasureImg,
    fallbackGradient: 'linear-gradient(135deg, #451a03 0%, #1e1b4b 55%, #f59e0b 100%)',
  },
  {
    id: 'coinflip',
    title: 'Coin Flip',
    tag: '50 / 50 Toss',
    category: 'Instant',
    htmlPath: '/assets/aistudio/coinflip_8c423882.html',
    bannerImage: gameCoinflipImg,
    fallbackGradient: 'linear-gradient(135deg, #3b0764 0%, #1e1b4b 55%, #fbbf24 100%)',
  },
  {
    id: 'rps',
    title: 'Rock Paper Scissors',
    tag: 'RPS Battle',
    category: 'Cards & Duel',
    htmlPath: '/assets/aistudio/rps_6971e0e4.html',
    bannerImage: gameRpsImg,
    fallbackGradient: 'linear-gradient(135deg, #064e3b 0%, #3b0764 55%, #8b5cf6 100%)',
  },
];
