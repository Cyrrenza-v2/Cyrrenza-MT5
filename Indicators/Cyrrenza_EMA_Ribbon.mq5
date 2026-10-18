//+------------------------------------------------------------------+
//| Cyrrenza EMA Ribbon                                              |
//| Visual trend ribbon inspired by the supplied EURUSD M5 chart.    |
//| Indicator only: it does not place or manage trades.               |
//+------------------------------------------------------------------+
#property copyright "Cyrrenza"
#property version   "1.00"
#property description "Eight-EMA trend ribbon with green bullish and red bearish coloring."
#property indicator_chart_window
#property indicator_buffers 16
#property indicator_plots   8

#property indicator_type1   DRAW_COLOR_LINE
#property indicator_type2   DRAW_COLOR_LINE
#property indicator_type3   DRAW_COLOR_LINE
#property indicator_type4   DRAW_COLOR_LINE
#property indicator_type5   DRAW_COLOR_LINE
#property indicator_type6   DRAW_COLOR_LINE
#property indicator_type7   DRAW_COLOR_LINE
#property indicator_type8   DRAW_COLOR_LINE

#property indicator_color1  clrMediumSeaGreen, clrLightCoral
#property indicator_color2  clrMediumSeaGreen, clrLightCoral
#property indicator_color3  clrMediumSeaGreen, clrLightCoral
#property indicator_color4  clrMediumSeaGreen, clrLightCoral
#property indicator_color5  clrMediumSeaGreen, clrLightCoral
#property indicator_color6  clrMediumSeaGreen, clrLightCoral
#property indicator_color7  clrMediumSeaGreen, clrLightCoral
#property indicator_color8  clrMediumSeaGreen, clrLightCoral

#property indicator_width1  2
#property indicator_width2  2
#property indicator_width3  2
#property indicator_width4  2
#property indicator_width5  2
#property indicator_width6  2
#property indicator_width7  2
#property indicator_width8  2

input int FastEMA = 8;
input int EMA2    = 10;
input int EMA3    = 12;
input int EMA4    = 14;
input int EMA5    = 16;
input int EMA6    = 18;
input int EMA7    = 21;
input int SlowEMA = 24;

double Line1[], Color1[], Line2[], Color2[], Line3[], Color3[];
double Line4[], Color4[], Line5[], Color5[], Line6[], Color6[];
double Line7[], Color7[], Line8[], Color8[];

int h1=INVALID_HANDLE, h2=INVALID_HANDLE, h3=INVALID_HANDLE, h4=INVALID_HANDLE;
int h5=INVALID_HANDLE, h6=INVALID_HANDLE, h7=INVALID_HANDLE, h8=INVALID_HANDLE;

int OnInit()
{
   int periods[8];
   periods[0]=FastEMA; periods[1]=EMA2; periods[2]=EMA3; periods[3]=EMA4;
   periods[4]=EMA5; periods[5]=EMA6; periods[6]=EMA7; periods[7]=SlowEMA;
   for(int i=0;i<8;i++)
   {
      if(periods[i]<1 || (i>0 && periods[i]<=periods[i-1]))
      {
         Print("EMA periods must be positive and strictly increasing.");
         return INIT_PARAMETERS_INCORRECT;
      }
   }

   SetIndexBuffer(0,Line1,INDICATOR_DATA); SetIndexBuffer(1,Color1,INDICATOR_COLOR_INDEX);
   SetIndexBuffer(2,Line2,INDICATOR_DATA); SetIndexBuffer(3,Color2,INDICATOR_COLOR_INDEX);
   SetIndexBuffer(4,Line3,INDICATOR_DATA); SetIndexBuffer(5,Color3,INDICATOR_COLOR_INDEX);
   SetIndexBuffer(6,Line4,INDICATOR_DATA); SetIndexBuffer(7,Color4,INDICATOR_COLOR_INDEX);
   SetIndexBuffer(8,Line5,INDICATOR_DATA); SetIndexBuffer(9,Color5,INDICATOR_COLOR_INDEX);
   SetIndexBuffer(10,Line6,INDICATOR_DATA); SetIndexBuffer(11,Color6,INDICATOR_COLOR_INDEX);
   SetIndexBuffer(12,Line7,INDICATOR_DATA); SetIndexBuffer(13,Color7,INDICATOR_COLOR_INDEX);
   SetIndexBuffer(14,Line8,INDICATOR_DATA); SetIndexBuffer(15,Color8,INDICATOR_COLOR_INDEX);

   for(int p=0;p<8;p++)
   {
      PlotIndexSetInteger(p,PLOT_DRAW_BEGIN,periods[p]-1);
      PlotIndexSetString(p,PLOT_LABEL,"EMA "+IntegerToString(periods[p]));
   }

   h1=iMA(_Symbol,_Period,FastEMA,0,MODE_EMA,PRICE_CLOSE);
   h2=iMA(_Symbol,_Period,EMA2,0,MODE_EMA,PRICE_CLOSE);
   h3=iMA(_Symbol,_Period,EMA3,0,MODE_EMA,PRICE_CLOSE);
   h4=iMA(_Symbol,_Period,EMA4,0,MODE_EMA,PRICE_CLOSE);
   h5=iMA(_Symbol,_Period,EMA5,0,MODE_EMA,PRICE_CLOSE);
   h6=iMA(_Symbol,_Period,EMA6,0,MODE_EMA,PRICE_CLOSE);
   h7=iMA(_Symbol,_Period,EMA7,0,MODE_EMA,PRICE_CLOSE);
   h8=iMA(_Symbol,_Period,SlowEMA,0,MODE_EMA,PRICE_CLOSE);
   if(h1==INVALID_HANDLE || h2==INVALID_HANDLE || h3==INVALID_HANDLE || h4==INVALID_HANDLE ||
      h5==INVALID_HANDLE || h6==INVALID_HANDLE || h7==INVALID_HANDLE || h8==INVALID_HANDLE)
   {
      Print("Could not create one or more EMA handles. Error: ",GetLastError());
      return INIT_FAILED;
   }
   IndicatorSetString(INDICATOR_SHORTNAME,"Cyrrenza EMA Ribbon ("+
                      IntegerToString(FastEMA)+"-"+IntegerToString(SlowEMA)+")");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   if(h1!=INVALID_HANDLE) IndicatorRelease(h1);
   if(h2!=INVALID_HANDLE) IndicatorRelease(h2);
   if(h3!=INVALID_HANDLE) IndicatorRelease(h3);
   if(h4!=INVALID_HANDLE) IndicatorRelease(h4);
   if(h5!=INVALID_HANDLE) IndicatorRelease(h5);
   if(h6!=INVALID_HANDLE) IndicatorRelease(h6);
   if(h7!=INVALID_HANDLE) IndicatorRelease(h7);
   if(h8!=INVALID_HANDLE) IndicatorRelease(h8);
}

int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
{
   if(rates_total<SlowEMA) return 0;
   if(BarsCalculated(h1)<rates_total || BarsCalculated(h8)<rates_total) return prev_calculated;

   int count=rates_total;
   double a1[],a2[],a3[],a4[],a5[],a6[],a7[],a8[];
   ArrayResize(a1,count); ArrayResize(a2,count); ArrayResize(a3,count); ArrayResize(a4,count);
   ArrayResize(a5,count); ArrayResize(a6,count); ArrayResize(a7,count); ArrayResize(a8,count);
   ArraySetAsSeries(a1,true); ArraySetAsSeries(a2,true); ArraySetAsSeries(a3,true); ArraySetAsSeries(a4,true);
   ArraySetAsSeries(a5,true); ArraySetAsSeries(a6,true); ArraySetAsSeries(a7,true); ArraySetAsSeries(a8,true);

   if(CopyBuffer(h1,0,0,count,a1)!=count || CopyBuffer(h2,0,0,count,a2)!=count ||
      CopyBuffer(h3,0,0,count,a3)!=count || CopyBuffer(h4,0,0,count,a4)!=count ||
      CopyBuffer(h5,0,0,count,a5)!=count || CopyBuffer(h6,0,0,count,a6)!=count ||
      CopyBuffer(h7,0,0,count,a7)!=count || CopyBuffer(h8,0,0,count,a8)!=count)
      return prev_calculated;

   // Indicator buffers are indexed as time series: index 0 is the current bar.
   ArraySetAsSeries(Line1,true); ArraySetAsSeries(Color1,true);
   ArraySetAsSeries(Line2,true); ArraySetAsSeries(Color2,true);
   ArraySetAsSeries(Line3,true); ArraySetAsSeries(Color3,true);
   ArraySetAsSeries(Line4,true); ArraySetAsSeries(Color4,true);
   ArraySetAsSeries(Line5,true); ArraySetAsSeries(Color5,true);
   ArraySetAsSeries(Line6,true); ArraySetAsSeries(Color6,true);
   ArraySetAsSeries(Line7,true); ArraySetAsSeries(Color7,true);
   ArraySetAsSeries(Line8,true); ArraySetAsSeries(Color8,true);

   for(int i=0;i<count;i++)
   {
      double values[8]={a1[i],a2[i],a3[i],a4[i],a5[i],a6[i],a7[i],a8[i]};
      int trend=(a1[i]>=a8[i] ? 0 : 1); // 0 = green/bullish, 1 = red/bearish
      Line1[i]=values[0]; Color1[i]=trend;
      Line2[i]=values[1]; Color2[i]=trend;
      Line3[i]=values[2]; Color3[i]=trend;
      Line4[i]=values[3]; Color4[i]=trend;
      Line5[i]=values[4]; Color5[i]=trend;
      Line6[i]=values[5]; Color6[i]=trend;
      Line7[i]=values[6]; Color7[i]=trend;
      Line8[i]=values[7]; Color8[i]=trend;
   }
   return rates_total;
}
//+------------------------------------------------------------------+
