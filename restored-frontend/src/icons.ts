
import React from 'react';
import {
    // UI Essentials
    Gift, FileSignature, Armchair, Cookie, Sparkles, Film, Crown, Users,
    // --- FOOD & SNACKS ---
    Apple, Banana, Beef, Cake, Candy, Carrot, Cherry, Citrus, Coffee, Croissant, CupSoda, Donut, Drumstick, Egg, Fish, Grape, Ham, IceCream, Lollipop, Milk, Nut, Pizza, Popcorn, Sandwich, Soup, Wheat, Utensils, Beer, Wine, Martini,
    // --- SCHOOL & STATIONERY ---
    Archive, Backpack, Bell, Book, BookOpen, Bookmark, Box, Briefcase, Calculator, Calendar, Clipboard, ClipboardList, Compass, Computer, DraftingCompass, Eraser, Feather, File, FileText, FileX, Folder, Glasses, Globe, GraduationCap, Highlighter, Hourglass, Laptop, Library, Lightbulb, Link, Lock, Mail, Map, Megaphone, Mic, Monitor, Mouse, Notebook, Paperclip, Pen, PenTool, Pin, Printer, Projector, Ruler, Scissors, Sheet, Smartphone, Speaker, Stamp, Sticker, StickyNote, Table, Tablet, Tag, Telescope, Terminal, Timer, Type, Video, Wallet, Watch, Wifi,
    // --- FUN & TOYS ---
    Activity, Airplay, Anchor, Aperture, Axe, Baby, Bean, Bed, Bike, Binary, Bird, Bone, Bot, Bug, Bus, Camera, Car, Castle, Cat, Clapperboard, Clock, Cloud, Club, Code, Construction, Diamond, Dice1, Dice5, Disc, Dna, Dog, Drum, Dumbbell, Ear, Earth, Eye, Fan, Flag, Flame, Flashlight, Flower, Footprints, Gamepad, Gamepad2, Gavel, Gem, Ghost, Guitar, Hammer, Hand, HardHat, Headphones, Heart, Home, Image, Inbox, Infinity, Joystick, Key, Lamp, Laugh, Layers, Leaf, LifeBuoy, Luggage, Magnet, MapPin, Medal, Meh, Moon, Mountain, Music, Navigation, Palette, Palmtree, PartyPopper, PawPrint, Phone, PiggyBank, Plane, Play, Plug, Pocket, Podcast, Power, Puzzle, Quote, Rabbit, Radio, Rainbow, Rocket, RockingChair, Sailboat, Scan, ScreenShare, Send, Shapes, Share2, Shield, Shirt, ShoppingCart, Shovel, Skull, Slack, Smile, Snowflake, Sofa, Spade, Star, Sun, Sword, Swords, Syringe, Target, Tent, Thermometer, ThumbsUp, Ticket, ToggleLeft, Tornado, ToyBrick, Tractor, TrafficCone, Train, Trash, TreeDeciduous, TreePine, Trophy, Truck, Tv, Twitch, Twitter, Umbrella, Unlock, Upload, Usb, User, Vibrate, Voicemail, Volume2, Wand, Waves, Webcam, Weight, Wind, Wrench, Zap
} from 'lucide-react';

// 1. Build the Master Map
export const MASTER_ICON_MAP: Record<string, React.FC<any>> = {
    // Defaults
    Gift, FileSignature, Armchair, Cookie, Sparkles, Film, Crown, Users,
    // Food
    Apple, Banana, Beef, Cake, Candy, Carrot, Cherry, Citrus, Coffee, Croissant, CupSoda, Donut, Drumstick, Egg, Fish, Grape, Ham, IceCream, Lollipop, Milk, Nut, Pizza, Popcorn, Sandwich, Soup, Wheat, Utensils, Beer, Wine, Martini,
    // School
    Archive, Backpack, Bell, Book, BookOpen, Bookmark, Box, Briefcase, Calculator, Calendar, Clipboard, ClipboardList, Clock, Compass, Computer, DraftingCompass, Eraser, Feather, File, FileText, FileX, Folder, Glasses, Globe, GraduationCap, Highlighter, Hourglass, Laptop, Library, Lightbulb, Link, Lock, Mail, Map, Megaphone, Mic, Monitor, Mouse, Notebook, Paperclip, Pen, PenTool, Pin, Printer, Projector, Ruler, Scissors, Sheet, Smartphone, Speaker, Stamp, Sticker, StickyNote, Table, Tablet, Tag, Telescope, Terminal, Timer, Type, Video, Wallet, Watch, Wifi,
    // Fun
    Activity, Airplay, Anchor, Aperture, Axe, Baby, Bean, Bed, Bike, Binary, Bird, Bone, Bot, Bug, Bus, Camera, Car, Castle, Cat, Clapperboard, Cloud, Club, Code, Construction, Diamond, Dice1, Dice5, Disc, Dna, Dog, Drum, Dumbbell, Ear, Earth, Eye, Fan, Flag, Flame, Flashlight, Flower, Footprints, Gamepad, Gamepad2, Gavel, Gem, Ghost, Guitar, Hammer, Hand, HardHat, Headphones, Heart, Home, Image, Inbox, Infinity, Joystick, Key, Lamp, Laugh, Layers, Leaf, LifeBuoy, Luggage, Magnet, MapPin, Medal, Meh, Moon, Mountain, Music, Navigation, Palette, Palmtree, PartyPopper, PawPrint, Phone, PiggyBank, Plane, Play, Plug, Pocket, Podcast, Power, Puzzle, Quote, Rabbit, Radio, Rainbow, Rocket, RockingChair, Sailboat, Scan, ScreenShare, Send, Shapes, Share2, Shield, Shirt, ShoppingCart, Shovel, Skull, Slack, Smile, Snowflake, Sofa, Spade, Star, Sun, Sword, Swords, Syringe, Target, Tent, Thermometer, ThumbsUp, Ticket, ToggleLeft, Tornado, ToyBrick, Tractor, TrafficCone, Train, Trash, TreeDeciduous, TreePine, Trophy, Truck, Tv, Twitch, Twitter, Umbrella, Unlock, Upload, Usb, User, Vibrate, Voicemail, Volume2, Wand, Waves, Webcam, Weight, Wind, Wrench, Zap
};

// 2. Define Categories for the UI
export const ICON_CATEGORIES = {
    'food': { label: '🍔 美食', icons: ['Cookie', 'IceCream', 'Pizza', 'Cake', 'Lollipop', 'Candy', 'Coffee', 'CupSoda', 'Donut', 'Popcorn', 'Sandwich', 'Apple', 'Banana', 'Cherry', 'Citrus', 'Grape', 'Carrot', 'Beef', 'Drumstick', 'Fish', 'Ham', 'Egg', 'Croissant', 'Wheat', 'Milk', 'Nut', 'Soup', 'Beer', 'Utensils'] },
    'school': { label: '🎒 文具', icons: ['Pencil', 'Pen', 'Highlighter', 'Eraser', 'Ruler', 'Scissors', 'Book', 'BookOpen', 'Notebook', 'StickyNote', 'Paperclip', 'Backpack', 'Calculator', 'Compass', 'DraftingCompass', 'Glasses', 'GraduationCap', 'Laptop', 'Tablet', 'Printer', 'FileText', 'Folder', 'Archive', 'Clipboard', 'Palette', 'Paintbrush', 'Feather', 'PenTool', 'Sticker', 'Tag', 'Pin', 'Map', 'Globe', 'Telescope', 'Terminal', 'Brain', 'Lightbulb', 'Bell', 'Megaphone', 'Briefcase', 'Monitor', 'Mouse', 'Watch', 'Wifi'] },
    'fun': { label: '🎮 娱乐', icons: ['Gamepad', 'Gamepad2', 'Joystick', 'Dice1', 'Dice5', 'Puzzle', 'ToyBrick', 'Ghost', 'Skull', 'Bot', 'Smile', 'Laugh', 'PartyPopper', 'Gift', 'Music', 'Headphones', 'Speaker', 'Mic', 'Camera', 'Video', 'Film', 'Tv', 'Radio', 'Clapperboard', 'Image', 'Guitar', 'Drum', 'Bike', 'Car', 'Bus', 'Train', 'Plane', 'Rocket', 'Sailboat'] },
    'privilege': { label: '👑 特权', icons: ['Ticket', 'Crown', 'Medal', 'Trophy', 'Award', 'Star', 'Heart', 'ThumbsUp', 'Zap', 'Flame', 'Shield', 'Sword', 'Key', 'Lock', 'Unlock', 'Flag', 'Gavel', 'Armchair', 'Sofa', 'Bed', 'Clock', 'Hourglass', 'Timer', 'Calendar', 'MapPin', 'Navigation', 'Coins', 'Gem', 'Diamond', 'Wallet', 'PiggyBank'] },
    'misc': { label: '🧩 杂项', icons: ['Sun', 'Moon', 'Cloud', 'Snowflake', 'Flower', 'Leaf', 'TreeDeciduous', 'Cat', 'Dog', 'Bird', 'Rabbit', 'Bone', 'PawPrint', 'Footprints', 'Umbrella', 'ShoppingBag', 'ShoppingCart', 'Shirt', 'Luggage', 'Home', 'Castle', 'Tent', 'Hammer', 'Wrench', 'Trash', 'User', 'Users', 'Baby'] }
};
